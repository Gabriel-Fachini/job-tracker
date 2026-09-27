import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { CompanyForm } from "@/components/companies/company-form";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { cn } from "@/lib/utils";
import { createCompany } from "@/server/actions/companies";

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
      <PageHeader
        leading={
          <Link
            href="/companies"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
          >
            <ChevronLeft data-icon="inline-start" />
            Empresas
          </Link>
        }
        title="Nova empresa"
        description="Candidaturas já salvas com o mesmo nome de empresa são vinculadas automaticamente."
      />

      {hasValidationError ? (
        <Notice tone="negative" bordered className="max-w-3xl">
          Não foi possível salvar a empresa. Revise o nome e as URLs informadas.
        </Notice>
      ) : null}

      <CompanyForm
        action={createCompany}
        cancelHref="/companies"
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
          logoUrl: "",
          status: "monitoring",
          notes: "",
        }}
      />
    </div>
  );
}
