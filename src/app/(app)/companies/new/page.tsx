import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { CompanyForm } from "@/components/companies/company-form";
import { createCompany } from "@/server/actions/companies";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CompaniesNewPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function CompaniesNewPage({
  searchParams,
}: CompaniesNewPageProps) {
  const params = await searchParams;
  const hasValidationError = params.error === "validation";

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/companies"
          className={cn(buttonVariants({ variant: "ghost" }), "w-fit rounded-xl")}
        >
          <ChevronLeft data-icon="inline-start" />
          Voltar para empresas
        </Link>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-emerald-200/70">
            Novo cadastro
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Registre uma empresa antes que a oportunidade escape do radar.
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            A ideia aqui não é lotar a base com ruído. É construir um painel
            enxuto de empresas que merecem observação, contexto e continuidade.
          </p>
        </div>
      </div>

      {hasValidationError ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive">
          Não foi possível salvar a empresa. Revise o nome e as URLs informadas.
        </div>
      ) : null}

      <CompanyForm
        action={createCompany}
        cancelHref="/companies"
        title="Cadastro da empresa"
        description="Monte a ficha-base da empresa, seus links e o status inicial. Se já existirem candidaturas com o mesmo nome, o sistema faz a ligação automaticamente."
        submitLabel="Salvar empresa"
        submitPendingLabel="Salvando empresa..."
        values={{
          name: "",
          website: "",
          sector: "",
          size: "",
          jobsBoardUrl: "",
          jobBoardNavigationMode: "fetch",
          glassdoorUrl: "",
          status: "monitoring",
          notes: "",
        }}
      />
    </div>
  );
}
