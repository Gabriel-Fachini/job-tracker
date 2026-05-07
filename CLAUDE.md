# Job Tracker - Project Context

## AI Runtime

**Ollama: Cloud Mode**
- `OLLAMA_RUNTIME_MODE=cloud` — Classification de leads roda via HTTP call remoto, não local
- Ambos `extractJobDetail` (HTTP fetch ao job board) e `classifyJobLead` (HTTP ao Ollama cloud) são I/O bound
- Paralelização segura: links processados em concurrent batch de 5 com `p-limit`

### Ganho de Performance
- Paralelização reduz tempo de processamento ~80% em boards extensos
- ~2s por link → ~100s sequencial para 50 links → ~20s paralelo

## Job Monitoring Features

### Real-time Progress (SSE)
- Route Handler: `src/app/api/monitoring/stream/route.ts`
- Emits events: `start`, `company-start`, `link-done`, `company-done`, `all-done`, `error`
- Client consumes via `EventSource` API
- Shows: "Buscando em [Company] (N/Total)" real-time

### Link Processing Pipeline
- Phase 1: Parallel extraction + classification with `pLimit(5)`
- Phase 2: Sequential upsert + stats accumulation
- Per-link events emitted for granular UI updates

## Job Description Formatting

**Optional OpenAI Formatting:**
- `OPENAI_FORMAT_JOB_DESCRIPTIONS=true|false` (default: `false`)
- When enabled, descriptions lacking markdown structure (no `\n\n`, `#`, `-`, `*`, `**`) are reformatted via OpenAI (gpt-4o-mini) during Phase 1 extraction
- Converts unstructured HTML/text into clean markdown with sections, lists, and bold terms
- Non-blocking: format errors log and keep original description
- Controlled via environment variable to manage API costs

## Database Backups

**Before any database schema changes or migrations:**
- Run `npm run db:backup` to create snapshot
- Automatic daily backups at 03:00 via launchd (7 daily, 4 weekly, 3 monthly)
- Restore with `npm run db:restore backups/daily/job-tracker-YYYY-MM-DD.db.gz`

## Architecture Notes

- No background processes yet (manual triggers only)
- No cron scheduling (future feature)
- SQLite + Next.js server actions for mutations
- SSE sufficient for real-time UX without process separation
