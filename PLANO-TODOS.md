# Plano de Desenvolvimento — Todos 3, 4 e 5

Ordem de execução: **4 → (stop) → 3 → (stop) → 5**.

---

## Todo 4 — Reposicionar botão "Abrir vaga" no modal de lead

**Problema:** Botão "Abrir vaga" sobreposto ao botão de fechar (X) no modal de lead.

**Arquivos envolvidos:**
- `src/components/leads/lead-detail-modal.tsx:70-78` — botão "Abrir vaga"
- `src/components/ui/dialog.tsx:63-76` — botão de fechar (`absolute top-2 right-2`)

**Causa:** Dialog renderiza X em `top-2 right-2`. Header do modal coloca "Abrir vaga" na mesma área superior, gerando sobreposição visual.

**Plano:**
1. Inspecionar layout atual do header em `lead-detail-modal.tsx` (DialogHeader/Title + link "Abrir vaga").
2. Mover botão "Abrir vaga" para fora da área do close button. Opções (escolher uma):
   - **Opção A (preferida):** mover botão para footer do modal (`DialogFooter` ou container ao final do conteúdo).
   - **Opção B:** manter no header mas adicionar `pr-10` (ou `mr-8`) ao container do título/ações para reservar espaço do X.
3. Ajustar spacing (`gap`, `mt`) para alinhamento limpo.
4. Testar visualmente em desktop e mobile (resize).

**Critério de aceite:**
- Botão "Abrir vaga" visualmente separado do X.
- Sem sobreposição em viewport ≥ 360px.
- Click no X continua funcionando sem precisar mirar.

**Stop point:** apresentar resultado (screenshot/diff) ao usuário.

---

## Todo 3 — Limpar lixo no final da descrição da vaga

**Problema:** Descrições têm resíduos no final (ex: textos boilerplate, footer de plataforma, scripts não filtrados).

**Arquivos envolvidos:**
- `src/lib/job-monitoring/extraction.ts:36-92` — `extractJobDetail()`
- `src/lib/job-monitoring/extraction.ts:369-392` — `finalizeDescription()` (ponto central de limpeza)
- `src/components/applications/job-markdown.tsx` — render (não muda)

**Plano:**
1. **Coletar amostras:** rodar query no SQLite (ou inspecionar logs recentes) para extrair 5-10 descrições reais com lixo no final, agrupadas por plataforma (Gupy, Greenhouse, Lever, Monks, etc).
2. **Catalogar padrões:** identificar regex / sentinelas comuns. Exemplos esperados:
   - "Sobre a [Empresa]" boilerplate repetido.
   - "Compartilhe esta vaga", "Indique um amigo".
   - URLs de tracking.
   - JSON-LD residual / `<script>`.
   - Frases de cookies / LGPD genéricas.
3. **Implementar limpeza em `finalizeDescription()`:**
   - Array de regex `TRAILING_NOISE_PATTERNS` aplicado **só do final pra trás** (não meio do texto).
   - Loop: enquanto última seção (split por `\n\n`) match algum pattern, remover.
   - Trim final whitespace e linhas vazias múltiplas.
4. **Considerar por-plataforma:** se padrões muito diferentes, adicionar `cleanByPlatform(description, platform)` chamado antes do clean genérico.
5. **Testes:**
   - Adicionar fixtures em `__tests__/` (ou pasta similar) com input sujo + output esperado.
   - Reprocessar 1-2 vagas existentes via script ou re-extração para validar.
6. **Não perder conteúdo legítimo:** patterns devem ser específicos (anchored ao fim, com âncoras claras), não greedy.

**Critério de aceite:**
- Amostras coletadas mostram descrição limpa após `finalizeDescription`.
- Nenhuma descrição perde conteúdo de responsabilidades / requisitos.
- Regex documentadas com comentário do que removem.

**Stop point:** apresentar antes/depois ao usuário, listar patterns aplicados.

---

## Todo 5 — Persistir progresso do radar entre navegações/reload

**Problema:** Estado de progresso vive em `useState` em `monitoring-run-button.tsx`. Sair da página ou reload destrói EventSource e estado.

**Arquivos envolvidos:**
- `src/components/leads/monitoring-run-button.tsx:59-90,280-328` — state + EventSource
- `src/components/leads/monitoring-progress-display.tsx` — display
- `src/components/leads/leads-client.tsx` — parent
- `src/app/api/monitoring/stream/route.ts` — SSE endpoint

**Estratégia escolhida: server-side run state + global client subscription.**

Persistência só em localStorage não basta — EventSource morre no unmount. Precisa: (a) processo do radar continua no servidor mesmo se cliente desconectar; (b) qualquer página pode reconectar e ler progresso atual.

**Plano:**

### Backend
1. **Run state em memória do servidor** (`src/lib/job-monitoring/run-state.ts`, novo):
   - Singleton `Map<runId, RunState>` (ou single `currentRun` já que parece ter 1 ativo por vez).
   - `RunState`: `{ id, status, startedAt, currentCompany, processed, total, events: Event[], lastUpdatedAt }`.
   - API: `startRun()`, `appendEvent(ev)`, `finishRun()`, `getCurrentRun()`.
   - **Persistência opcional em SQLite** para sobreviver restart do dev server: tabela `monitoring_run` (id, status, payload JSON, started_at, finished_at). Atualiza a cada evento (debounced 500ms) ou no `all-done`.
2. **Refatorar `runAllCompaniesMonitoringStream`** para escrever em `run-state` além de emitir SSE. SSE continua funcionando como hoje pra cliente ativo; estado replicado pra reconexões.
3. **Novo endpoint `GET /api/monitoring/current`** retorna snapshot do run atual (status + últimos N eventos). Cliente usa pra hidratar ao montar.
4. **Stream endpoint suporta reconexão:** query param `?since=<eventIndex>` retorna eventos perdidos + continua live. Se nenhum run ativo, fecha imediatamente.

### Frontend
5. **Mover progress state pra contexto global:**
   - Criar `MonitoringProgressProvider` (React Context) em `src/components/leads/monitoring-progress-context.tsx`.
   - Provider montado no layout `src/app/(app)/layout.tsx` — vive durante toda navegação dentro de (app).
   - Provider gerencia EventSource único; reconecta automaticamente.
6. **Hidratação no mount do Provider:**
   - Fetch `/api/monitoring/current`.
   - Se status = "running", abre EventSource e popula state.
7. **Componentes (`monitoring-run-button`, `monitoring-progress-display`) consomem context** via `useMonitoringProgress()`.
8. **Display global "minimizado":** quando user navega pra fora de `/leads`, mostrar barra fixa (top ou bottom) com "Radar rodando — N/Total" + link de volta. Componente `<MonitoringMiniBar>` no layout, lê context, só renderiza se `status === "running"`.
9. **Reload do browser:** Provider remonta → fetch `/current` → reabre EventSource → state hidratado. Transparente.

### Edge cases
- Restart do servidor durante run: status fica órfão. Solução: timeout (ex: 30min sem update → marcar `stale`) + flag manual de cancelar.
- Múltiplas abas: cada uma abre próprio EventSource — OK, mesmo stream.
- Run terminado: Provider mantém último snapshot por X segundos pra usuário ver final, depois limpa.

**Critério de aceite:**
- Iniciar radar em `/leads`, navegar pra outra rota: mini-bar continua mostrando progresso.
- Reload (F5) durante run: progresso reaparece automaticamente.
- Fechar e reabrir aba: progresso reaparece.
- Run termina enquanto usuário está em outra página: notificação visível.

**Stop point:** entrega final.

---

## Notas gerais

- Todos itens vão pra commits separados (um por todo).
- Após cada todo: marcar `[x]` em `todos.md`.
- Sem testar UI no browser (server já roda na 3000 — não tocar).
