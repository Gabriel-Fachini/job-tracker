import { JobCreateForm } from "@/components/jobs/job-create-form";
import { FileText, NotebookPen, Orbit } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type NewJobPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function NewJobPage({ searchParams }: NewJobPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const hasValidationError = resolvedSearchParams?.error === "validation";

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.16),transparent_24%),radial-gradient(circle_at_85%_20%,rgba(56,189,248,0.14),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))] p-6 sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[linear-gradient(135deg,transparent,rgba(255,255,255,0.03),transparent)] lg:block" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Nova vaga
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Um fluxo manual pensado para captura rápida: cole a descrição,
              registre o contexto mínimo e preserve a oportunidade antes que ela
              desapareça do job board.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-amber-400/16 bg-amber-400/8 p-4">
              <NotebookPen className="mb-4 text-amber-200" />
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Ritmo
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                Registro em poucos campos
              </p>
            </div>
            <div className="rounded-2xl border border-sky-400/16 bg-sky-400/8 p-4">
              <Orbit className="mb-4 text-sky-200" />
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Fonte
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                Tudo salvo localmente
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/16 bg-emerald-400/8 p-4">
              <FileText className="mb-4 text-emerald-200" />
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Formato
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                Markdown como fonte de verdade
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.7fr)]">
        <Card className="border border-border/70 bg-card/95">
          <CardHeader className="border-b border-border/60 pb-5">
            <CardTitle className="text-2xl">Cadastro manual</CardTitle>
            <CardDescription className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Este recorte salva a descrição completa e os metadados essenciais
              para organizar o pipeline de aplicações. A empresa continua como
              texto livre neste momento.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {hasValidationError ? (
              <p className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Não foi possível salvar a vaga. Revise os campos obrigatórios e a
                URL antes de tentar novamente.
              </p>
            ) : null}
            <JobCreateForm cancelHref="/jobs" submitLabel="Salvar vaga" />
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]">
            <CardHeader>
              <CardTitle className="text-lg">O que importa aqui</CardTitle>
              <CardDescription>
                Menos formulário, mais contexto útil.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">Capture o essencial</p>
                <p>Título, empresa, origem e descrição já bastam para recuperar a oportunidade depois.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Markdown preservado</p>
                <p>Estrutura, headings, listas e ênfases ficam salvos como vieram da vaga.</p>
              </div>
              <div>
                <p className="font-medium text-foreground">Zero dependência de IA</p>
                <p>O fluxo continua útil mesmo sem extração automática ou extensão ativa.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]">
            <CardHeader>
              <CardTitle className="text-lg">Critério de qualidade</CardTitle>
            </CardHeader>
            <CardContent className="text-sm leading-6 text-muted-foreground">
              Se a tela te deixa com vontade de colar uma vaga real sem pensar muito,
              ela está fazendo o trabalho certo.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
