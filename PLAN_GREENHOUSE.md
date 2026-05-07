# Plano de Integração — Greenhouse Job Board API

## Objetivo

Substituir scraping HTML por chamadas diretas à Job Board API pública da Greenhouse no fluxo do radar (`runMonitoringForCompany`), eliminando fragilidade de parsing e ganhando metadados estruturados (departments, offices, location, content HTML).

## Pesquisa de API

### Base URL e endpoints públicos

Base: `https://boards-api.greenhouse.io/v1/boards/{board_token}`

| Método | Path | Uso |
|--------|------|-----|
| GET | `/jobs` | Lista todas vagas publicadas |
| GET | `/jobs?content=true` | Lista com descrição HTML inline (evita N+1) |
| GET | `/jobs/{job_id}` | Detalhe completo de uma vaga |
| GET | `/departments` | Lista departamentos |
| GET | `/offices` | Lista escritórios |
| GET | `/{board_token}` | Nome da org + conteúdo do board |

### Autenticação

GET endpoints são **públicos** — sem auth. Apenas POST de aplicação requer Basic Auth com API key Base64. Para nosso caso (read-only radar), zero credenciais.

### `board_token`

Identificador único da empresa no Greenhouse. Aparece no URL público:
- `https://boards.greenhouse.io/{board_token}`
- `https://job-boards.greenhouse.io/{board_token}`

Extraível do `companies.jobsBoardUrl` por regex.

### Shape da resposta `/jobs?content=true`

```json
{
  "jobs": [
    {
      "id": 127817,
      "internal_job_id": 144381,
      "title": "Vault Designer",
      "updated_at": "2016-01-14T10:55:28-05:00",
      "requisition_id": "50",
      "location": { "name": "NYC" },
      "absolute_url": "https://boards.greenhouse.io/vaulttec/jobs/127817",
      "language": "en",
      "metadata": null,
      "content": "<p>HTML description...</p>",
      "departments": [{ "id": 13583, "name": "...", "parent_id": null, "child_ids": [] }],
      "offices": [{ "id": 8304, "name": "East Coast", "location": "United States" }]
    }
  ],
  "meta": { "total": 1 }
}
```

`content` vem como HTML com entities (`&lt;`, `&gt;`). Precisa decode + html-to-markdown.

### Paginação e rate limit

Sem paginação documentada para `/jobs` — retorna tudo de uma vez. Rate limit não documentado oficialmente; observar 429 e backoff. Sem auth = não há quota por chave.

## Integração no fluxo do radar

### Pontos de toque

| Arquivo | Mudança |
|---------|---------|
| [src/lib/db/schema.ts:89](src/lib/db/schema.ts) | Adicionar `companies.atsProvider` (`greenhouse`/`gupy`/`inhire`/`generic`) e `atsBoardToken` |
| [src/lib/job-monitoring/discovery.ts:53](src/lib/job-monitoring/discovery.ts) | Roteamento por `atsProvider`. Se `greenhouse` → chamar API |
| `src/lib/job-monitoring/providers/greenhouse.ts` (novo) | Cliente HTTP + parser de resposta |
| [src/lib/job-monitoring/extraction.ts:36](src/lib/job-monitoring/extraction.ts) | Bypass quando provider conhecido fornece detalhe inline |
| [src/lib/job-monitoring/index.ts:53](src/lib/job-monitoring/index.ts) | Quando provider retorna `content` direto, pular `extractJobDetailFn` |

### Detecção / configuração

Form de empresa: dropdown "ATS Provider" com opções `auto`, `greenhouse`, `gupy`, `inhire`, `generic`.

`auto` → infere por hostname:
- `boards.greenhouse.io` ou `job-boards.greenhouse.io` → greenhouse
- `*.gupy.io` → gupy
- `*.inhire.app` → inhire
- senão → generic (fluxo HTML atual)

Migration: backfill `atsProvider` com `auto` para registros existentes.

### Pipeline novo (provider greenhouse)

1. `discoverJobLinks(company)` detecta provider, extrai `boardToken` de `jobsBoardUrl`
2. `GET /v1/boards/{token}/jobs?content=true` (1 request, todas vagas)
3. Mapear cada job da resposta para `DiscoveredLink` **enriquecido** com `prefetched: { title, description, location, departments, offices, updatedAt }`
4. Em `runMonitoringForCompany` ([index.ts:96](src/lib/job-monitoring/index.ts:96)), se `link.prefetched` existir, pular `extractJobDetailFn` e usar dado direto
5. Converter `content` (HTML) → markdown via `turndown` (já é dependência? checar; senão adicionar). Aplicar `formatJobDescriptionAsMarkdown` apenas se markdown gerado for raso
6. Classificação + upsert seguem inalterados

### Schema do `DiscoveredLink`

Hoje (em [discovery.ts](src/lib/job-monitoring/discovery.ts)): `{ url: string, text?: string }`. Estender:

```ts
type DiscoveredLink = {
  url: string;
  text?: string;
  prefetched?: {
    title: string;
    descriptionHtml: string;
    descriptionMarkdown?: string;
    locationText?: string;
    departments?: string[];
    offices?: string[];
    updatedAt?: string;
    externalId: string;
  };
};
```

### `sourceName`

Setar `jobLeads.sourceName = "greenhouse"` quando origem for API. Atualizar `detectSourceName` ([extraction.ts:255](src/lib/job-monitoring/extraction.ts:255)) para incluir.

## Markdown formatting

`content` Greenhouse é HTML válido. Uso recomendado:

1. Decode HTML entities
2. `turndown` → markdown
3. Se `OPENAI_FORMAT_JOB_DESCRIPTIONS=true` E markdown não tem cabeçalhos/listas → reformatar via OpenAI (mantém comportamento atual, [openai.ts:276](src/lib/ai/openai.ts:276))
4. Persistir em `jobLeads.description`

## Erros e edge cases

- **404 em `/jobs/{id}`**: vaga removida entre listagem e detalhe → marcar como discarded, logar
- **Token inválido**: 404 no `/jobs` → retornar erro de configuração, evento SSE `error`
- **Vagas internas**: API só expõe públicas; não há filtro extra
- **Vagas sem `content`**: API retorna `content: ""` → pular formatação, classificar com título + departments + offices
- **HTML rate limit**: usar `pLimit(5)` global mantém pressão baixa (1 req por empresa Greenhouse, não por vaga)
- **Múltiplas localizações**: `location.name` é string única; se vaga tem múltiplos `offices`, juntar com vírgula

## Passos de implementação

1. `npm run db:backup`
2. Schema: adicionar `atsProvider`, `atsBoardToken` em `companies`
3. `npm run db:generate` → revisar SQL → `npm run db:migrate`
4. Criar `src/lib/job-monitoring/providers/greenhouse.ts` com `fetchGreenhouseJobs(boardToken)`
5. Criar `src/lib/job-monitoring/providers/index.ts` com `resolveProvider(company)` e `discoverViaProvider(company)`
6. Estender tipo `DiscoveredLink` em [src/lib/job-monitoring/types.ts](src/lib/job-monitoring/types.ts)
7. Em `discoverJobLinks` ([discovery.ts:53](src/lib/job-monitoring/discovery.ts:53)) adicionar branch provider antes do fluxo HTML
8. Em `runMonitoringForCompany` ([index.ts:109](src/lib/job-monitoring/index.ts:109)) usar `link.prefetched` se presente
9. Adicionar `turndown` se ausente: `npm i turndown @types/turndown`
10. UI: campo `atsProvider` no formulário de empresa ([src/components/companies/...](src/components/companies))
11. Testes manuais com 1 empresa Greenhouse real (e.g. `https://boards.greenhouse.io/airbnb`)
12. Verificar SSE eventos `link-done` continuam funcionando (`MonitoringProgressContext` invalida `["leads"]`)

## Riscos

- Mudança de shape do `DiscoveredLink` afeta `extraction.ts` e callers — buscar todos usos antes
- Greenhouse devolve `content` em HTML que pode ter scripts/iframes; sanitizar ou strip antes do markdown
- Empresas que mudam de ATS quebram inferência `auto` — UI deve permitir override manual

## Sources

- [Job Board API | Greenhouse](https://developers.greenhouse.io/job-board.html)
- [greenhouse-api-docs/_jobs.md](https://github.com/grnhse/greenhouse-api-docs/blob/master/source/includes/job-board/_jobs.md)
- [Greenhouse API overview](https://support.greenhouse.io/hc/en-us/articles/10568627186203-Greenhouse-API-overview)
