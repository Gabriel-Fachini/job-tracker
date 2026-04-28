import { appNavigation } from "@/lib/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ModulePlaceholderProps = {
  href: string;
  eyebrow: string;
  title: string;
  description: string;
};

export function ModulePlaceholder({
  href,
  eyebrow,
  title,
  description,
}: ModulePlaceholderProps) {
  const navItem = appNavigation.find((item) => item.href === href);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          {eyebrow}
        </p>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Shell da Fase 1 pronto</CardTitle>
            <CardDescription>
              Esta rota ja existe dentro da estrutura final do App Router e pode
              receber as implementacoes das fases seguintes sem trocar o shell
              do produto.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm leading-6 text-muted-foreground">
            <p>
              O layout compartilhado agora centraliza navegacao lateral,
              cabecalho, area principal e a preparacao para dados server-side.
            </p>
            <p>
              Quando a fase correspondente comecar, esta pagina pode ser
              substituida pelo fluxo real sem alterar URLs, hierarquia ou a
              composicao base do app.
            </p>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Proximo marco</CardTitle>
            <CardDescription>
              {navItem
                ? `${navItem.phase} prevista em .specs/tasks.md`
                : "Aguardando a fase funcional correspondente"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm leading-6 text-muted-foreground">
            <p>
              Caminho: <span className="font-mono text-foreground">{href}</span>
            </p>
            {navItem ? <p>{navItem.summary}</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
