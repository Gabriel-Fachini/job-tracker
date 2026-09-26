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
    <div className="flex flex-1 flex-col gap-5 sm:gap-6">
      <div className="flex flex-col gap-3 sm:gap-4">
        <Link
          href="/companies"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 w-fit rounded-lg text-muted-foreground",
          )}
        >
          <ChevronLeft data-icon="inline-start" />
          Empresas
        </Link>

        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-[1.75rem] leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
            Nova empresa
          </h1>
          <p className="max-w-2xl text-sm text-pretty text-muted-foreground sm:text-base">
            Uma base enxuta de empresas que merecem observação, contexto e continuidade.
          </p>
        </div>
      </div>

      {hasValidationError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Não foi possível salvar a empresa. Revise o nome e as URLs informadas.
        </div>
      ) : null}

      <CompanyForm
        action={createCompany}
        cancelHref="/companies"
        title="Cadastro da empresa"
        description="Monte a ficha-base da empresa, seus links e o status inicial. Se já existirem candidaturas com o mesmo nome, o sistema faz a ligação automaticamente."
        submitLabel="Salvar empresa"
        submitPendingLabel="Salvando…"
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
