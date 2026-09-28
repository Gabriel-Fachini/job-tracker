"use client";

import { useTransition } from "react";
import { ScanSearch } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { discoverCompanyAts } from "@/server/actions/companies";

const providerLabels: Record<string, string> = {
  ashby: "Ashby",
  lever: "Lever",
  greenhouse: "Greenhouse",
};

export function DiscoverAtsButton({ companyId, companyName }: { companyId: number; companyName: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await discoverCompanyAts(companyId);

      if (result.ok) {
        toast.success(`${providerLabels[result.provider] ?? result.provider} encontrado`, {
          description: `${companyName}: ${result.jobsCount} vagas abertas. O radar foi ligado para esta empresa.${
            result.via === "slug" ? " O board foi achado pelo nome; confira se é mesmo a empresa." : ""
          }`,
        });
        return;
      }

      if (result.error === "has-board") {
        toast.info("Esta empresa já tem um job board cadastrado.");
      } else if (result.error === "not-found") {
        toast.error("Esta empresa não existe mais. Recarregue a página.");
      } else {
        toast("Nenhum ATS encontrado", {
          description: "Procurei Ashby, Lever e Greenhouse no site e pelo nome da empresa.",
        });
      }
    });
  }

  return (
    <Button disabled={isPending} onClick={handleClick} type="button" variant="outline">
      <ScanSearch data-icon="inline-start" className={isPending ? "motion-safe:animate-pulse" : undefined} />
      {isPending ? "Procurando…" : "Descobrir ATS"}
    </Button>
  );
}
