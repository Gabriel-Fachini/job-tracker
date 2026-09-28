"use client";

import { useState, useTransition } from "react";
import { Radar as RadarIcon } from "lucide-react";
import { toast } from "sonner";

import { Notice } from "@/components/ui/notice";
import { Panel, PanelBody } from "@/components/ui/panel";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { setCompanyRadarEnabled } from "@/server/actions/companies";

type CompanyRadarToggleProps = {
  companyId: number;
  companyName: string;
  radarEnabled: boolean;
  /** False when there's no valid job board URL: the radar has nothing to scan. */
  hasJobsBoardUrl: boolean;
  /** True for "discarded"/"blacklist": the bulk scan skips it either way. */
  isStatusSkipped: boolean;
};

export function CompanyRadarToggle({
  companyId,
  companyName,
  radarEnabled,
  hasJobsBoardUrl,
  isStatusSkipped,
}: CompanyRadarToggleProps) {
  const [checked, setChecked] = useState(radarEnabled);
  const [isPending, startTransition] = useTransition();

  function handleChange(next: boolean) {
    setChecked(next);

    startTransition(async () => {
      const result = await setCompanyRadarEnabled(companyId, next);

      if (!result.ok) {
        setChecked(!next);
        toast.error("Não foi possível atualizar o radar desta empresa.");
        return;
      }

      toast.success(next ? "Incluída no próximo scan" : "Fora do próximo scan", {
        description: companyName,
      });
    });
  }

  const blockedReason = !hasJobsBoardUrl
    ? "Sem job board cadastrado, o radar não tem o que varrer aqui mesmo ligado."
    : isStatusSkipped
      ? "Status atual (Descartada ou Blacklist) já pula esta empresa na varredura em lote, independente deste switch."
      : null;

  return (
    <Panel className="overflow-hidden">
      <PanelBody className="flex flex-wrap items-start justify-between gap-4 sm:flex-nowrap">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              checked ? "bg-primary/12 text-primary" : "bg-muted text-subtle-foreground",
            )}
          >
            <RadarIcon className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Radar de vagas</p>
            <p className="mt-0.5 text-[13px] text-pretty text-muted-foreground">
              {checked
                ? "Esta empresa entra na próxima varredura em lote."
                : "Esta empresa fica de fora da próxima varredura em lote."}
            </p>
            {blockedReason ? (
              <Notice tone="caution" className="mt-2">
                {blockedReason}
              </Notice>
            ) : null}
          </div>
        </div>

        <label className="flex shrink-0 items-center gap-2.5">
          <span className="text-[13px] font-medium text-muted-foreground">
            {checked ? "Ligado" : "Desligado"}
          </span>
          <Switch
            checked={checked}
            disabled={isPending}
            onCheckedChange={handleChange}
            aria-label={`Incluir ${companyName} no próximo scan do radar`}
          />
        </label>
      </PanelBody>
    </Panel>
  );
}
