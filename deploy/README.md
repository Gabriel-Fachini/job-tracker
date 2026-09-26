# Deploy (VPS)

Deploy automático **pull-based**: um timer systemd no servidor verifica `origin/main` a cada 5 minutos. Se houver commit novo, o [`deploy.sh`](deploy.sh):

1. Exporta o commit para uma release nova em `/srv/job-tracker/releases/<data>-<sha>`.
2. Roda `npm ci`, `playwright install chromium` e `npm run build`. Se falhar, a versão atual continua no ar.
3. Espera terminar um radar em andamento (até 30 min), para não matar o scan no restart.
4. Faz backup do SQLite (`/var/lib/job-tracker/backups/pre-deploy`, últimos 5) e roda `drizzle-kit migrate`.
5. Troca o symlink `current`, reinicia o app e faz health check em `/dashboard`. Se falhar, **rollback automático** para a release anterior.
6. Mantém as 3 releases mais recentes.

Um commit que falhou não é tentado de novo até existir um commit mais novo (ou `FORCE=1`).

Nenhum segredo fica no GitHub: o servidor só lê o repositório público. Etapas que executam código do repo rodam como `jobtracker`. O script que roda como root fica em `/usr/local/sbin` e só muda quando `install.sh` é executado de novo.

## Layout no servidor

| Caminho | Conteúdo |
|---|---|
| `/srv/job-tracker/repo` | clone usado só para `git fetch` |
| `/srv/job-tracker/releases/*` | releases compiladas |
| `/srv/job-tracker/current` | symlink para a release ativa |
| `/etc/job-tracker/env` | variáveis de ambiente (640 `root:jobtracker`, sem aspas nem espaços nos valores) |
| `/var/lib/job-tracker/data` | SQLite + uploads |
| `/var/lib/job-tracker/backups` | backups diários (`daily/`, `weekly/`, `monthly/`) e `pre-deploy/` |

## Instalação inicial

```bash
# 1. a partir de qualquer checkout atualizado do repo (ex.: o clone antigo em /opt/job-tracker)
sudo -u jobtracker -H git -C /opt/job-tracker pull
sudo bash /opt/job-tracker/deploy/install.sh

# 2. primeiro deploy manual (mostra o progresso no terminal)
sudo /usr/local/sbin/job-tracker-deploy

# 3. ativa os timers (deploy a cada 5 min + backup diário às 03:00)
sudo bash /srv/job-tracker/repo/deploy/install.sh

# 4. depois de validar o app, remove o clone antigo
sudo rm -rf /opt/job-tracker
```

Se o primeiro deploy falhar no health check, restaure a unit antiga (`/etc/systemd/system/job-tracker.service.bak-*`), rode `sudo systemctl daemon-reload` e depois `sudo systemctl restart job-tracker`.

## Operação

```bash
# logs do deploy / do app
journalctl -u job-tracker-deploy -n 100 --no-pager
journalctl -u job-tracker -f

# próximos disparos dos timers
systemctl list-timers 'job-tracker-*'

# deploy manual / forçar redeploy
sudo /usr/local/sbin/job-tracker-deploy
sudo FORCE=1 /usr/local/sbin/job-tracker-deploy

# backup manual
sudo systemctl start job-tracker-backup
```

**Rollback:** prefira `git revert` do commit problemático e push na `main`, que o timer faz o deploy. Para voltar na hora sem mexer no git:

```bash
sudo systemctl stop job-tracker-deploy.timer   # evita redeploy do commit ruim
ls -1dt /srv/job-tracker/releases/*/
sudo -u jobtracker ln -sfn /srv/job-tracker/releases/<RELEASE> /srv/job-tracker/current.new
sudo -u jobtracker mv -Tf /srv/job-tracker/current.new /srv/job-tracker/current
sudo systemctl restart job-tracker
# depois de corrigir a main: sudo systemctl start job-tracker-deploy.timer
```

**Restaurar o banco:**

```bash
sudo systemctl stop job-tracker-deploy.timer job-tracker
sudo -u jobtracker env DATABASE_URL=/var/lib/job-tracker/data/job-tracker.db \
  /srv/job-tracker/current/scripts/restore-db.sh /var/lib/job-tracker/backups/daily/job-tracker-AAAA-MM-DD.db.gz
sudo systemctl start job-tracker job-tracker-deploy.timer
```

**Upgrade do Playwright:** quando a versão do `playwright` mudar, as bibliotecas de sistema do Chromium precisam de root e ficam como passo manual: `cd /srv/job-tracker/current && sudo npx playwright install-deps chromium`.

**Mudou `deploy.sh` ou `systemd/*`:** rode `sudo bash /srv/job-tracker/repo/deploy/install.sh` depois que o commit chegar ao servidor.

> Os backups ficam no mesmo disco da VPS: protegem contra erro/corrupção, não contra perda da VM. Backup externo (ex.: restic → Backblaze B2) é um próximo passo.
