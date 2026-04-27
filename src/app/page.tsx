import { BriefcaseBusiness, LayoutDashboard, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 sm:p-10">
      <section className="flex w-full max-w-5xl flex-col gap-8 rounded-4xl border border-border bg-card p-8 shadow-sm sm:p-10">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BriefcaseBusiness aria-hidden className="size-4" />
            Bootstrap inicial concluido
          </div>
          <div className="flex max-w-3xl flex-col gap-3">
            <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Job Tracker
            </h1>
            <p className="text-base leading-7 text-muted-foreground sm:text-lg">
              Base do projeto pronta com Next.js 16, Tailwind CSS v4 e
              shadcn/ui configurados para as proximas fases do app.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="flex flex-col gap-3 rounded-3xl border border-border bg-background p-5">
            <Sparkles aria-hidden className="size-5 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <h2 className="font-medium">Stack inicial</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                App Router, TypeScript estrito, alias <code>@/*</code> e
                Turbopack nos scripts locais.
              </p>
            </div>
          </article>

          <article className="flex flex-col gap-3 rounded-3xl border border-border bg-background p-5">
            <LayoutDashboard
              aria-hidden
              className="size-5 text-muted-foreground"
            />
            <div className="flex flex-col gap-1">
              <h2 className="font-medium">UI configurada</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Tokens de tema, utilitario <code>cn</code> e componente{" "}
                <code>Button</code> adicionados via shadcn.
              </p>
            </div>
          </article>

          <article className="flex flex-col gap-3 rounded-3xl border border-border bg-background p-5">
            <BriefcaseBusiness
              aria-hidden
              className="size-5 text-muted-foreground"
            />
            <div className="flex flex-col gap-1">
              <h2 className="font-medium">Proximo passo</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                A fase seguinte pode entrar em banco local com Drizzle e SQLite.
              </p>
            </div>
          </article>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button">Estrutura inicial validada</Button>
          <Button type="button" variant="outline">
            Pronto para a tarefa 1.4
          </Button>
        </div>
      </section>
    </main>
  );
}
