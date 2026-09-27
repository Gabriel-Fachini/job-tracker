# Desenvolvimento local

## Requisitos

| Ferramenta | Para quê | Obrigatório? |
|---|---|---|
| Node.js + npm | app (o Mac usa Node 24; o projeto não fixa `engines`) | sim |
| `sqlite3` (CLI) | `db:backup`, `db:restore`, inspeção | sim para backup |
| Chave OpenAI | extração de perfil a partir do PDF | para o fluxo de perfil |
| Ollama local **ou** chave do Ollama Cloud | classificação de leads, currículo, "Formatar" | para radar e currículo |
| Chromium do Playwright | radar em modo `browser` | só para empresas com `browser` |
| `tectonic` | compilar o currículo LaTeX | só para gerar currículo |

```bash
npx playwright install chromium   # uma vez
brew install tectonic              # macOS
```

## Primeiro setup

```bash
npm install
cp .env.example .env.local        # preencha as chaves
```

Banco: o `drizzle-kit migrate` **não funciona num banco vazio** (ver [banco-de-dados.md](banco-de-dados.md#banco-novo-vazio-não-migra)). Opções:

- restaurar um backup: `npm run db:restore backups/daily/job-tracker-AAAA-MM-DD.db.gz`;
- criar a partir do schema de um banco existente (`sqlite3 <db> .schema`), como no preview sintético abaixo.

Com um banco já migrado, `npm run db:migrate` aplica só o que falta.

## Variáveis de ambiente

Arquivo `.env.local` (gitignored). Modelo em [`.env.example`](../.env.example).

| Variável | Default no código | Onde é lida | Notas |
|---|---|---|---|
| `DATABASE_URL` | `./job-tracker.db` | `src/lib/db/index.ts`, `drizzle.config.ts`, scripts de backup | Em produção precisa ser caminho absoluto de um arquivo existente |
| `UPLOADS_PATH` | `./uploads` | uploads de currículo, PDFs gerados, logos | resolvido a partir do `cwd` |
| `OLLAMA_RUNTIME_MODE` | — (obrigatória) | `src/lib/ai/ollama.ts` | `local` ou `cloud` |
| `OLLAMA_BASE_URL` | — (obrigatória) | idem | local: `http://127.0.0.1:11434` |
| `OLLAMA_MODEL` | — (obrigatória) | idem | ex.: `gemma3:4b` |
| `OLLAMA_API_KEY` | — | idem | obrigatória em `cloud` |
| `OLLAMA_TIMEOUT_MS` | `240000` | idem | por chamada |
| `OPENAI_API_KEY` | — | `src/lib/ai/openai.ts` | extração de perfil; formatação opcional |
| `OPENAI_COMPARISON_MODEL` | `gpt-5.4` | idem | modelo da extração de perfil. Não deixe definida e vazia. |
| `OPENAI_FORMAT_JOB_DESCRIPTIONS` | `false` | `src/lib/job-monitoring/index.ts` | `true` formata descrições do radar com `gpt-4o-mini` |
| `SAMPLE_PROFILE_*` | nome/contatos fictícios | `src/lib/latex/__fixtures__/sample-profile.ts` | só `npm run resume:sample` e testes |
| `NODE_ENV` | definido pelo Next | `src/lib/db/index.ts` | `production` liga o fail-closed do banco |

Variáveis já definidas no ambiente do processo **vencem** o `.env.local` (o Next não sobrescreve). Isso é o que permite apontar um preview para outro banco sem editar o `.env.local`.

O hook de início de sessão dos agentes avisa se faltar `OLLAMA_RUNTIME_MODE`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` ou `OLLAMA_API_KEY`.

## Scripts npm

| Script | O que faz | Estado |
|---|---|---|
| `dev` | `next dev --turbopack` | ok |
| `build` / `start` | `next build --turbopack` / `next start` | ok |
| `lint` | `eslint` (config Next core-web-vitals + TypeScript) | ok |
| `test:job-monitoring` | `node --import tsx --test src/lib/job-monitoring/*.test.ts` | 2 falhas conhecidas |
| `test:escape` | só `src/lib/latex/escape.test.ts` | ok |
| `db:generate` | `drizzle-kit generate` | ok desde `8db7fd9` (cadeia de snapshots religada; `drizzle-kit check` passa) |
| `db:migrate` | `drizzle-kit migrate` | ok em banco já migrado; falha em banco vazio |
| `db:backup` / `db:restore` | scripts em `scripts/` | ok |
| `resume:sample` | renderiza o currículo fictício com `tectonic` | ok (precisa de `tectonic`) |
| `test:profile-extraction`, `analyze:profile-extractions` | apontam para `tmp/*.ts` | **mortos**: os arquivos não existem mais |

Typecheck: `npm run typecheck` (`tsc --noEmit`). Testes e lint em [testes-e-qualidade.md](testes-e-qualidade.md).

## Servidor de desenvolvimento

- O usuário mantém o app rodando em `http://localhost:3000`. **Não suba outro `npm run dev`** para testar; use o que está no ar.
- Se `:3000` não responder, peça para o usuário iniciar.
- Se precisar de um servidor isolado (ex.: banco sintético), suba em outra porta e **encerre ao terminar**. O hook `SessionEnd` mata `next dev` órfão e o que estiver em `:3000`.
- `.claude/launch.json` define `dev` (`npm run dev`, porta 3000, `autoPort`). O arquivo é versionado: entradas temporárias de preview precisam ser revertidas depois.

### Celular na mesma rede

`next.config.ts` tem `allowedDevOrigins` com o IP do Mac na rede local, para abrir o dev server no telefone. Trocar ou ampliar essa lista (ex.: `192.168.*.*`) é decisão do usuário; agentes foram bloqueados ao tentar, por ser afrouxamento de segurança.

## Banco sintético para preview

Desde 2026-09-25 a VPS é a fonte da verdade. O banco do Mac não tem leads recentes em triagem, então telas de leads precisam de dados semeados para serem verificadas. Não copie o banco real para outro lugar.

Receita usada no checkout principal (2026-09-26):

```bash
sqlite3 job-tracker.db .schema > tmp/preview-schema.sql
sqlite3 tmp/redesign-preview.db < tmp/preview-schema.sql
# inserir linhas obviamente fictícias (empresas, leads, candidaturas)
```

Depois rode um servidor com `DATABASE_URL` (e `UPLOADS_PATH`) no ambiente do processo. No checkout principal, com o `next dev` do usuário no ar, **um segundo `next dev` não sobe** (trava `.next/dev/lock`). O que funciona (2026-09-27):

```bash
env DATABASE_URL=./tmp/preview.db UPLOADS_PATH=./tmp/preview-uploads npm run build
```

O build grava em `.next/*` ao lado de `.next/dev` sem atrapalhar o dev server. Em seguida, uma entrada temporária no `.claude/launch.json`, iniciada pelo preview do Claude:

```json
{
  "name": "preview",
  "runtimeExecutable": "/usr/bin/env",
  "runtimeArgs": ["DATABASE_URL=./tmp/preview.db", "UPLOADS_PATH=./tmp/preview-uploads", "npx", "next", "start", "-p", "3100"],
  "port": 3100
}
```

- Cada mudança de código exige novo build (~1 min).
- Fluxos que gravam (editar, excluir) são testados só ali, nunca no banco real.
- Ao terminar: pare o servidor, apague tudo em `.next/` **exceto** `dev/` (o `rtk` rejeita `find -exec`; use um loop no shell) e reverta o `launch.json`.

`tmp/` é gitignored.

### Em worktree de agente (`.claude/worktrees/*`)

- Política bloqueia o agente de criar symlink para o `.env.local` do repo principal ou copiar o `job-tracker.db` real para a worktree. Não insista.
- Funciona: rodar com `DATABASE_URL` não definido, usando o `./job-tracker.db` da própria worktree (gitignored), preenchido com seed fictício.
- O ESLint ignora `.claude/worktrees/**`; rode o lint de dentro da worktree.

## Armadilhas do ambiente

- **CSS velho no Turbopack**: o cache `.next/dev` pode servir um `globals.css` antigo (variáveis novas de `:root` ausentes, mesmo após reiniciar, enquanto utilitários novos aparecem). Aconteceu em worktree e também no servidor do usuário em `:3000` (o build de produção tinha os valores certos). Pare o servidor, `rm -rf .next` (ou só `.next/dev`), suba de novo; no `:3000`, só o usuário reinicia. Antes de depurar o componente, confira o valor com `getComputedStyle`.
- **Browser pane do Claude Desktop**: `resize_window` com tamanho maior que o painel (ex.: 1440×900) gera screenshot cortado/preto. Use os presets `desktop` (tamanho do painel) ou `mobile`.
- **Dados pessoais em `tmp/logs/`**: a extração de perfil grava a saída bruta ali. Não anexe esses arquivos em lugar nenhum.
