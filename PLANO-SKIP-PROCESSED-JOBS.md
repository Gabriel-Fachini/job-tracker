# Plano: Skip de Vagas Já Processadas no Radar

## Contexto

Ao rodar o radar de monitoramento, o pipeline atual:
1. Descobre todos os links de cada board (`discoverJobLinks`)
2. Para **cada link descoberto**, faz extract + classify (HTTP fetch + Ollama LLM)
3. Faz upsert no banco — update se já existe, insert se é novo

O problema: nas runs subsequentes, vagas já processadas passam novamente por extract + classify, desperdiçando tempo e recursos (cada link leva ~2s de I/O).

## Objetivo

- **Primeira run**: processar e persistir todos os links descobertos (comportamento atual)
- **Runs subsequentes**: links que já existem no banco (`jobLeads` com mesmo `companyId + sourceUrl`) devem ser **pulados** — sem extract, sem classify
- Somente links **novos** (não presentes no banco) passam pelo pipeline completo

---

## Análise do Pipeline Atual

### Fluxo atual (`src/lib/job-monitoring/index.ts`)

```
discoverJobLinks()                    → DiscoveredLink[]
  └─ pLimit(5) forEach link:
       extractJobDetail(link.url)      → ExtractedJobDetail   ← HTTP fetch
       classifyJobLead(detail)         → JobLeadClassification ← Ollama LLM
  └─ forEach settled result:
       upsertJobLead(lead)             → { id, created, leadSnapshot }
```

### Deduplicação atual

`upsertJobLead` (`src/lib/job-monitoring/persistence.ts:10`) já verifica `(companyId, sourceUrl)`:
- Se existe → UPDATE (reclassifica, sobrescreve)
- Se não existe → INSERT

O banco tem unique index em `(companyId, sourceUrl)` (`src/lib/db/schema.ts:170-174`).

### O que falta

Nenhuma verificação ocorre **antes** de entrar no Phase 1. Todo link descoberto entra no pool de extract+classify.

---

## Solução

### Ponto de intervenção

Adicionar uma etapa entre `discoverJobLinks` e o Phase 1 (extract+classify):

```
discoverJobLinks()                    → DiscoveredLink[]
  └─ filterAlreadyProcessedLinks()    → { newLinks, skippedLinks }  ← NOVO
  └─ pLimit(5) forEach newLinks only:
       extractJobDetail(link.url)
       classifyJobLead(detail)
  └─ forEach settled result:
       upsertJobLead(lead)
```

### Implementação

#### 1. Nova função em `persistence.ts`

**Arquivo**: `src/lib/job-monitoring/persistence.ts`

Adicionar função que recebe um array de URLs e retorna quais já existem no banco para uma determinada empresa:

```typescript
export async function getExistingJobLeadUrls(
  companyId: number,
  sourceUrls: string[]
): Promise<Set<string>>
```

- Query: `SELECT sourceUrl FROM jobLeads WHERE companyId = ? AND sourceUrl IN (?)`
- Retorna `Set<string>` para lookup O(1)
- Usa a mesma instância de `db` já importada no arquivo

#### 2. Filtro em `index.ts`

**Arquivo**: `src/lib/job-monitoring/index.ts`

Na função `runMonitoringForCompany`, após `discoverJobLinks`, antes do Phase 1:

```typescript
const discoveredLinks: DiscoveredLink[] = await discoverJobLinks(company);

// NOVO: filtrar links já processados
const discoveredUrls = discoveredLinks.map(l => l.url);
const existingUrls = await getExistingJobLeadUrls(company.id, discoveredUrls);

const newLinks = discoveredLinks.filter(l => !existingUrls.has(l.url));
const skippedCount = discoveredLinks.length - newLinks.length;

// Phase 1: processar somente newLinks
const phase1Results = await Promise.allSettled(
  newLinks.map(link => limit(async () => { /* extract + classify */ }))
);
```

#### 3. Eventos SSE para links pulados

**Arquivo**: `src/lib/job-monitoring/index.ts`

Emitir evento `link-skipped` para cada link pulado, para que a UI possa mostrar progresso correto:

```typescript
for (const skippedUrl of existingUrls) {
  onEvent?.({
    type: 'link-skipped',
    url: skippedUrl,
    companyId: company.id,
  });
}
```

**Arquivo**: `src/lib/job-monitoring/types.ts`

Adicionar ao union `MonitoringStreamEvent`:

```typescript
| {
    type: 'link-skipped';
    url: string;
    companyId: number;
  }
```

#### 4. Resumo da run (`MonitoringSummary`)

**Arquivo**: `src/lib/job-monitoring/types.ts`

Adicionar campo `skippedCount` ao tipo `MonitoringSummary`:

```typescript
export type MonitoringSummary = {
  // campos existentes...
  totalLinks: number;
  newLinks: number;      // NOVO: links processados nesta run
  skippedLinks: number;  // NOVO: links já existentes, pulados
  // ...
};
```

**Arquivo**: `src/server/actions/job-monitoring.ts`

Atualizar acumulação do summary para incluir `skippedLinks` retornado por `runMonitoringForCompany`.

#### 5. Retorno de `runMonitoringForCompany`

**Arquivo**: `src/lib/job-monitoring/index.ts`

A função já retorna `MonitoringSummary`. Incluir `skippedLinks: skippedCount` no objeto retornado.

---

## Casos de Borda

### Lead deletado manualmente

Se o usuário deletar um lead do banco e rodar o radar novamente, o link não existirá mais em `existingUrls`, então será reprocessado normalmente. Comportamento correto.

### Lead com `userDecision = "dismissed"`

Links descartados pelo usuário ainda existem no banco. Com esta mudança, eles **não serão reprocessados** em runs futuras. Isso é o comportamento desejado — o usuário já tomou uma decisão.

Se no futuro for necessário permitir reclassificar vagas descartadas, adicionar opção `forceReprocess: boolean` como parâmetro da run — fora do escopo deste plano.

### Vaga que mudou de conteúdo no board

Esta solução assume que `sourceUrl` identifica univocamente uma vaga e que o conteúdo não muda. Se a vaga foi atualizada no board externo, ela **não será reclassificada**. Aceitável para o caso de uso atual (job boards raramente editam listagens existentes).

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `src/lib/job-monitoring/persistence.ts` | Adicionar `getExistingJobLeadUrls()` |
| `src/lib/job-monitoring/index.ts` | Filtrar `newLinks` antes do Phase 1; emitir `link-skipped`; incluir `skippedLinks` no summary |
| `src/lib/job-monitoring/types.ts` | Adicionar `link-skipped` ao `MonitoringStreamEvent`; adicionar `skippedLinks` ao `MonitoringSummary` |
| `src/server/actions/job-monitoring.ts` | Acumular `skippedLinks` no summary batch |

---

## Arquivos a NÃO Modificar

- `src/lib/job-monitoring/discovery.ts` — discovery não muda, continua retornando todos os links
- `src/lib/job-monitoring/extraction.ts` — sem mudança
- `src/lib/job-monitoring/classification.ts` — sem mudança
- `src/lib/db/schema.ts` — sem mudança de schema (unique index já existe)
- `src/app/api/monitoring/stream/route.ts` — sem mudança na rota SSE

---

## Ordem de Implementação

1. `persistence.ts` — adicionar `getExistingJobLeadUrls` (isolado, sem dependências)
2. `types.ts` — adicionar `link-skipped` e `skippedLinks` nos tipos
3. `index.ts` — usar filtro + emitir evento
4. `server/actions/job-monitoring.ts` — acumular campo no summary

---

## Impacto Esperado

- **Segunda run em diante**: apenas vagas novas passam por extract+classify
- **Boards com 50 vagas estáveis**: ~0s de processamento na segunda run (só discovery + DB query)
- **Boards com 5 vagas novas**: ~10s ao invés de ~100s
- Comportamento da UI sem mudança visível (progresso continua funcionando via SSE)
