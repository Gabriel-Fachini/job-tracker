# Plano: Live Lead Updates com TanStack Query

## Contexto Atual

- **Phase 1** (`src/lib/job-monitoring/index.ts:93-217`): extração + classificação em paralelo com `pLimit(5)`
- **Phase 2** (`src/lib/job-monitoring/index.ts:219-303`): upsert sequencial + emit `link-done` por link
- Problema: Phase 1 processa TODOS os links antes de Phase 2 começar — usuário vê nada até scan completo
- `leads/page.tsx`: Server Component com query Drizzle direto, sem TanStack Query instalado

---

## Parte 1: Colapsar Phase 2 dentro de Phase 1

**Arquivo:** `src/lib/job-monitoring/index.ts`

Hoje cada tarefa no pool `pLimit(5)` retorna resultado acumulado para Phase 2 processar depois. Mudança: dentro de cada tarefa do pool, após classificar, executar `upsertJobLead()` imediatamente e emitir `link-done` ali mesmo.

**Passos:**

1. Dentro do callback `pLimit` de cada link (Phase 1), após `extractJobDetail()` e `classifyJobLead()`, chamar `upsertJobLead()` diretamente
2. Emitir evento `link-done` dentro do mesmo callback com o `lead` retornado do upsert
3. Acumular stats no mesmo callback (contador atômico com closure ou array push + reduce depois de `Promise.allSettled`)
4. Remover Phase 2 inteiro — já não necessário
5. Ajustar `runMonitoringForCompany()` para retornar stats acumulados do Phase 1

> **Nota:** SQLite em modo WAL suporta múltiplos writers concorrentes. Para garantir estabilidade local, considerar `pLimit(3)` em vez de `pLimit(5)` para reduzir contention em writes simultâneos. Testar com 5 primeiro — se der `SQLITE_BUSY`, reduzir.

**Resultado esperado:** cada link classificado → upsert imediato → `link-done` emitido → UI pode reagir em tempo real

---

## Parte 2: Instalar TanStack Query

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

**Arquivo novo:** `src/providers/query-provider.tsx`

```tsx
"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

**Arquivo:** `src/app/(app)/layout.tsx` — envolver com `<QueryProvider>`

---

## Parte 3: Criar Server Action para Fetch de Leads

**Arquivo:** `src/server/actions/leads.ts` (já existe com `approveLead` etc — adicionar função de fetch)

Criar função `getLeads()`:
- Mesma query que `leads/page.tsx` usa hoje
- Retorna `LeadListItem[]`
- Marcada como `"use server"` para ser chamável pelo TanStack Query no cliente

> TanStack Query no Next.js App Router pode chamar Server Actions diretamente como `queryFn`. Não precisa de route handler `/api/leads` — Server Action funciona como função async normal do lado do cliente quando marcada com `"use server"`.

---

## Parte 4: Refatorar LeadsClient para useQuery

**Arquivo:** `src/components/leads/leads-client.tsx`

**Hoje:**
```tsx
const [items, setItems] = useState(liveItems); // liveItems vem do server component
```

**Depois:**
```tsx
const { data: items = [] } = useQuery({
  queryKey: ["leads"],
  queryFn: () => getLeads(),
  initialData: initialLeads, // prop passada do server component
  staleTime: 30_000,
});
```

- `initialLeads` = dados do Server Component passados como prop (zero loading flicker no primeiro render)
- `staleTime: 30_000` = não refetch desnecessário em foco de janela durante scan
- Remover `useState(liveItems)` e toda lógica de update manual de state por SSE que hoje está no `leads-client`

---

## Parte 5: Invalidar Query por Evento SSE

**Arquivo:** `src/components/leads/monitoring-progress-context.tsx` — dentro de `applySSEEvent()`

```ts
import { useQueryClient } from "@tanstack/react-query";

// dentro do componente que usa o context:
const queryClient = useQueryClient();

// no handler de eventos SSE:
if (event.type === "link-done" && event.decision !== "discarded") {
  queryClient.invalidateQueries({ queryKey: ["leads"] });
}
```

**Por que apenas `decision !== "discarded"`:**
- Leads descartadas não aparecem no board
- `interesting` e `review` aparecem → invalida e refetch
- Evita refetches desnecessários para cada link descartado (pode ser maioria dos links)

---

## Parte 6: Ajustar Hierarquia de Providers no Layout

**Arquivo:** `src/app/(app)/layout.tsx`

Garantir ordem:
```tsx
<QueryProvider>
  <MonitoringProvider>  {/* pode chamar useQueryClient */}
    {children}
  </MonitoringProvider>
</QueryProvider>
```

`QueryProvider` deve envolver `MonitoringProvider` para que `useQueryClient` funcione dentro do context de monitoring.

---

## Parte 7: Limpar Leads Page Server Component

**Arquivo:** `src/app/(app)/leads/page.tsx`

- Manter query Drizzle no server para passar `initialData`
- Remover lógica de revalidação manual via `revalidatePath` para o caso de reads — TanStack Query `invalidateQueries` no cliente substitui
- Manter `revalidatePath` apenas para mutações de usuário (`approveLead`, `discardLead`, etc.) se outros componentes fora do TanStack Query precisarem dos dados

---

## Ordem de Execução

1. **Parte 1** — mover upsert para Phase 1 (independente do resto, testável via monitoring existente)
2. **Parte 2 + 3** — instalar TQ + criar server action (setup necessário antes de refatorar cliente)
3. **Parte 6** — hierarquia de providers (antes de qualquer `useQueryClient`)
4. **Parte 4** — refatorar LeadsClient (depende de 2 + 3 + 6)
5. **Parte 5** — invalidação SSE (depende de 4 + 6)
6. **Parte 7** — cleanup final (depois de validar que tudo funciona)

---

## Riscos e Decisões

| Questão | Decisão |
|---|---|
| SQLite concurrent writes em pLimit(5) | Testar com 5; se `SQLITE_BUSY` → reduzir para 3 |
| TanStack Query vs Route Handler | Server Action como `queryFn` — mais simples, sem nova rota |
| `initialData` vs `placeholderData` | `initialData` — tratado como fresco até staleTime, sem loading state no primeiro render |
| Refetch a cada `link-done` não-descartado | Aceitável para projeto local; não é prod com múltiplos users |
