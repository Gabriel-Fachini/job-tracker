# Memórias do agente

Conhecimento acumulado pelo Claude Code em sessões anteriores e guardado na memória persistente do agente (fora do repositório, em `~/.claude/projects/<projeto>/memory/`). Esta página é um **retrato de 2026-09-27**, trazido para o repo para ficar visível a qualquer pessoa ou agente.

Por o repositório ser público, os dados foram mascarados: nome do tailnet → `<TAILNET>`, domínio pessoal → `<DOMINIO_PESSOAL>`, IPs e detalhes de conta omitidos. Nenhum segredo existe nas memórias originais.

## 1. Plano de deploy e automação

*Tipo: projeto · registrada em 2026-09-25, atualizada em 2026-09-26*

Decisões do usuário para levar o job-tracker a um servidor e automatizar o monitoramento:

- **Hospedagem**: Oracle Cloud Always Free. O cadastro falhou num navegador com iCloud Private Relay (causa provável) e funcionou em outra máquina. Conta convertida para Pay As You Go porque a VM A1 dava "Out of capacity" no plano free; budget de alerta configurado. VCN criada pelo VCN Wizard.
- **VM**: A1, Ubuntu 24.04, Tailscale SSH funcionando (hostname `job-tracker`), porta 22 pública fechada.
- **Entrega**: app no ar com os dados migrados (commit `b0715d4`); deploy automático pull-based por timer systemd (pasta `deploy/`, commit `cc13ca0`); backup diário local às 03:00. Primeiro deploy automático ok (release em `/srv`, timers ativos, backup testado).
- **Sem GitHub Actions**: o usuário decidiu não usar, para não guardar chave do Tailscale no GitHub.
- **Env do servidor** é lido também por bash (`set -a; .`) no deploy: valores sem `<>` e sem espaços; placeholders só entre aspas.
- **Incidente de migrations**: `__drizzle_migrations` estava dessincronizado — `0013_outgoing_princess_powerful` e `0014_add_is_referral` já aplicadas no schema, mas sem registro. O `drizzle-kit migrate` falhava com exit 1 **sem mensagem** ("duplicate column"). Correção: inserir linhas de baseline (sha256 do `.sql` + `when` do journal). Quando o migrate falhar mudo, checar as colunas existentes com `sqlite3`.
- **Repositório público**: nunca commitar env, nome do tailnet, banco ou uploads. Env de produção em `/etc/job-tracker/env`.
- **Acesso** só via Tailscale (`tailscale serve`, zero porta pública, nunca `funnel`); Next escutando em `127.0.0.1`.
- **Banco** continua SQLite (o usuário disse "MySQL" por engano). A VPS vira fonte da verdade; o Mac fica só para dev. Backup offsite em outro provedor (R2/B2) com restic.
- **Scan agendado** 3×/dia: 09h, 14h e 19h `America/Sao_Paulo` (timer systemd → endpoint interno com token).
- **Digest diário** por e-mail via Resend (proposto 20h), enviado de um subdomínio de `<DOMINIO_PESSOAL>`. DNS no Registro.br; o apex aponta para o IP da Vercel — não mexer.
- **Candidaturas**: fila de aprovação, sem auto-submit.
- **Pendências** (em 2026-09-26): usuário preencher chaves reais em `/etc/job-tracker/env` (`OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_API_KEY`, `OPENAI_API_KEY` estavam com placeholder literal), backup offsite (B2), timers de scan, digest, fila de aprovação. A atualização do `CLAUDE.md` foi feita em 2026-09-27.

**Por quê:** o usuário quer acessar o app de qualquer lugar via VPN, tudo em free tier, e automatizar monitoramento + digest.
**Como aplicar:** propostas de código e infra seguem essas decisões. Tirar a premissa "radar só manual / sem cron" do `CLAUDE.md` faz parte do plano, quando os scans agendados existirem.

Aplicado em: [deploy-e-operacao.md](deploy-e-operacao.md), [roadmap-e-decisoes.md](roadmap-e-decisoes.md), [banco-de-dados.md](banco-de-dados.md).

## 2. URL de produção e layout da VPS

*Tipo: referência · registrada em 2026-09-26*

- App em produção: `https://job-tracker.<TAILNET>.ts.net/` (via `tailscale serve` → `127.0.0.1:3000`). Só abre em dispositivo conectado ao tailnet.
- **Nunca** colocar essa URL nem o nome do tailnet no repo; usar variável de ambiente no servidor (ex.: base URL para links do digest).
- SSH: `ssh job-tracker` (alias no `~/.ssh/config` do Mac → usuário `ubuntu`, Tailscale SSH).
- Layout: releases em `/srv/job-tracker/releases/*` + symlink `/srv/job-tracker/current` (antes do primeiro deploy automático era `/opt/job-tracker`); dados em `/var/lib/job-tracker/data` (banco + uploads); backups em `/var/lib/job-tracker/backups`; env em `/etc/job-tracker/env` (`640 root:jobtracker`); serviço `job-tracker.service` rodando como usuário `jobtracker`. Runbook: [`deploy/README.md`](../deploy/README.md).

Aplicado em: [deploy-e-operacao.md](deploy-e-operacao.md).

## 3. Preview de desenvolvimento com banco sintético

*Tipo: projeto · registrada em 2026-09-25 (sessão de UI mobile, PR `Gabriel-Fachini/job-tracker#3`), atualizada em 2026-09-26 e 2026-09-27*

- Em worktree (`.claude/worktrees/*`), a política bloqueia o agente de criar symlink para o `.env.local` do repo principal ou copiar o `job-tracker.db` real. Não tentar de novo. O que funcionou: rodar com `DATABASE_URL` não definido, usando o `./job-tracker.db` da worktree (gitignored) com seed obviamente fictício.
- `npx drizzle-kit migrate` falha num banco vazio (migrations `0007` e `0013`; em 2026-09-27 confirmado que as duas `0013` quebram). Uma correção foi sugerida como tarefa separada. Até lá, banco novo precisa de replay do schema.
- O cache de dev do Turbopack (`.next/dev`) serviu `globals.css` velho: variáveis novas de `:root` sumiam mesmo após reiniciar, enquanto utilitários novos apareciam. Correção: parar o servidor, `rm -rf .next`, subir de novo. Se uma edição em `globals.css` parecer ignorada, checar o valor com `getComputedStyle` antes de depurar o componente.
- No checkout principal (sessão de redesign, 2026-09-26): banco sintético sem copiar dados reais — `sqlite3 job-tracker.db .schema` → arquivo novo `tmp/redesign-preview.db` (`/tmp` é gitignored) + linhas fictícias; servidor com `DATABASE_URL` no ambiente do processo (vence o `.env.local`), ex.: entrada temporária no `.claude/launch.json` com `/usr/bin/env DATABASE_URL=./tmp/redesign-preview.db npm run dev`. O `launch.json` é versionado: reverter a entrada depois. O banco local real não tem leads em triagem (a VPS é a fonte da verdade), então UI de leads precisa de seed para ser verificada.
- Com o `next dev` do usuário rodando em `:3000` no checkout principal, um segundo `next dev` não sobe (`.next/dev/lock`). O que funcionou (2026-09-27, sessão do CRUD de empresas): `DATABASE_URL=./tmp/<nome>.db UPLOADS_PATH=./tmp/<nome>-uploads npm run build` (grava `.next/*` ao lado de `.next/dev` sem atrapalhar o dev) e depois uma entrada temporária no `launch.json` com `/usr/bin/env DATABASE_URL=... UPLOADS_PATH=... npx next start -p 3100`, iniciada pelo preview. Cada mudança exige rebuild (~1 min). Ao final, apagar tudo em `.next/` exceto `dev/` (o `rtk` rejeita `find -exec`; usar loop no shell) e reverter o `launch.json`. Fluxos de mutação (editar/excluir) são testados ali, nunca no banco real.
- O CSS velho do Turbopack também atingiu o servidor do usuário em `:3000` (variável `--logo-tile` e `bg-logo-tile` ausentes enquanto outros utilitários novos funcionavam; o build de produção tinha tudo). Só o usuário pode reiniciar o servidor dele (parar, `rm -rf .next/dev`, `npm run dev`).
- Browser pane: tamanhos customizados de `resize_window` maiores que o painel (ex.: 1440×900) geram screenshot cortado/preto; usar os presets `desktop` ou `mobile`.
- Ampliar `allowedDevOrigins` (ex.: `192.168.*.*`, para o celular alcançar o dev server) também foi bloqueado como afrouxamento de segurança. A decisão é do usuário.

**Por quê:** esses pontos custaram muito tempo de diagnóstico na primeira sessão mobile.
**Como aplicar:** ao fazer preview de UI numa worktree, semear dados sintéticos primeiro; se uma mudança de CSS não aparecer, suspeitar do cache do Turbopack antes do código.

Aplicado em: [desenvolvimento-local.md](desenvolvimento-local.md), [testes-e-qualidade.md](testes-e-qualidade.md).

## Fatos confirmados nesta sessão de documentação (2026-09-27)

Verificados lendo código ou executando comandos, e usados nas outras páginas:

- A rota do radar é **`GET`** `/api/monitoring/stream` (o `CLAUDE.md` antigo dizia `POST`).
- Descartes automáticos **são** gravados em `job_leads` (a doc antiga dizia que não).
- Até `cb455cc` o radar varria empresas de qualquer status; agora a varredura em lote pula `discarded` e `blacklist` (a individual não filtra).
- Falha de classificação não grava o lead (a doc antiga dizia que virava `review`).
- O banco local está em `journal_mode=delete`, não WAL; `foreign_keys` vem ligado pelo `better-sqlite3`.
- Suíte de testes: 36/38 passando (depois corrigido: expectativas de `index.test.ts` atualizadas, `npm test` → 61/61).
- Em paralelo a esta sessão, outra sessão editou empresas/logos, `DESIGN.md` e `CLAUDE.md` no mesmo checkout, commitou `8db7fd9` (snapshots religados) e `cb455cc` (CRUD + logos) e trocou o checkout para o branch `feat/companies-crud-logos`.

## Manutenção

- A memória do agente continua sendo a fonte de trabalho entre sessões; esta página não se atualiza sozinha. Ao registrar uma decisão nova relevante para o projeto, traga-a também para a doc correspondente.
- Nunca registrar segredos, tokens, IPs internos, URLs privadas ou dados pessoais aqui.
