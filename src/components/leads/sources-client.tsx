"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Play } from "lucide-react";
import { toast } from "sonner";

import { MonitoringRunButton } from "@/components/leads/monitoring-run-button";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { Panel, PanelHeader, PanelMeta, PanelTitle } from "@/components/ui/panel";
import { Switch } from "@/components/ui/switch";
import { Tag } from "@/components/ui/tag";
import {
  runSourceMonitoring,
  runSourcesMonitoring,
  setSourceEnabledAction,
} from "@/server/actions/sources";

export type SourceListItem = {
  id: number;
  name: string;
  homepage: string | null;
  enabled: boolean;
  lastRunAt: Date | null;
  lastError: string | null;
};

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function SourcesClient({ items }: { items: SourceListItem[] }) {
  const enabledCount = items.filter((item) => item.enabled).length;

  return (
    <Panel aria-labelledby="sources-title">
      <PanelHeader>
        <PanelTitle id="sources-title">Fontes agregadas</PanelTitle>
        <PanelMeta>
          <span className="font-data">{enabledCount}</span>/<span className="font-data">{items.length}</span> ativas
        </PanelMeta>
        <MonitoringRunButton
          action={runSourcesMonitoring}
          label="Rodar fontes"
          shortLabel="Rodar"
          pendingLabel="Rodando…"
        />
      </PanelHeader>
      <ul className="divide-y divide-border">
        {items.map((item) => (
          <SourceRow item={item} key={item.id} />
        ))}
      </ul>
    </Panel>
  );
}

function SourceRow({ item }: { item: SourceListItem }) {
  const [enabled, setEnabled] = useState(item.enabled);
  const [isToggling, startToggle] = useTransition();
  const [isRunning, startRun] = useTransition();

  function handleToggle(next: boolean) {
    setEnabled(next);

    startToggle(async () => {
      const result = await setSourceEnabledAction(item.id, next);

      if (!result.ok) {
        setEnabled(!next);
        toast.error("Não foi possível atualizar esta fonte.");
      }
    });
  }

  function handleRun() {
    startRun(async () => {
      const result = await runSourceMonitoring(item.id);

      if (!result.success) {
        toast.error(`Falha em ${item.name}`, { description: result.error });
        return;
      }

      toast.success(`${item.name}: ${result.leadsSaved} leads`, {
        description: `${result.linksFound} vagas no feed, ${result.skippedLinks} já conhecidas, ${result.discarded} descartadas`,
      });
    });
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3.5 sm:px-5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="min-w-0 truncate text-[15px] font-medium text-foreground">{item.name}</h2>
            {enabled ? (
              <Tag variant="status" color="green">
                Ativa
              </Tag>
            ) : (
              <Tag variant="status" color="muted">
                Desativada
              </Tag>
            )}
            {item.homepage ? (
              <a
                href={item.homepage}
                target="_blank"
                rel="noreferrer"
                aria-label={`Abrir ${item.name}`}
                className="text-subtle-foreground transition-colors hover:text-foreground"
              >
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            ) : null}
          </div>
          <p className="mt-0.5 text-[13px] text-subtle-foreground">
            {item.lastRunAt ? (
              <>
                Último run{" "}
                <time className="font-data" dateTime={item.lastRunAt.toISOString()}>
                  {dateTime.format(item.lastRunAt)}
                </time>
              </>
            ) : (
              "Ainda não rodou"
            )}
          </p>
        </div>

        <Button
          disabled={isRunning}
          onClick={handleRun}
          size="sm"
          type="button"
          variant="outline"
        >
          <Play data-icon="inline-start" />
          {isRunning ? "Rodando…" : "Rodar"}
        </Button>
        <label className="inline-flex shrink-0 items-center">
          <span className="sr-only">Incluir {item.name} no radar</span>
          <Switch checked={enabled} disabled={isToggling} onCheckedChange={handleToggle} />
        </label>
      </div>

      {item.lastError ? (
        <Notice tone="negative">
          <span className="break-words">Último erro: {item.lastError}</span>
        </Notice>
      ) : null}
    </li>
  );
}
