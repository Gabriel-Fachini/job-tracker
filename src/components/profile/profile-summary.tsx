import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ProfileSummaryProps = {
  profileSnapshot: Awaited<ReturnType<typeof import("@/lib/profile/queries").getProfileSnapshot>>;
};

export function ProfileSummary({ profileSnapshot }: ProfileSummaryProps) {
  if (!profileSnapshot) {
    return (
      <Card size="sm">
        <CardHeader>
          <CardTitle>Nenhum perfil extraído ainda</CardTitle>
          <CardDescription>
            Faça upload do PDF master para criar o primeiro registro
            estruturado do perfil no banco local.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const contactItems = [
    profileSnapshot.email,
    profileSnapshot.phone,
    profileSnapshot.location,
  ].filter((value): value is string => Boolean(value));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>{profileSnapshot.fullName}</CardTitle>
          <CardDescription>
            Perfil estruturado atual persistido a partir da extração mais
            recente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <SummaryMetric label="Experiências" value={profileSnapshot.experiences.length} />
            <SummaryMetric label="Habilidades" value={profileSnapshot.skills.length} />
            <SummaryMetric label="Projetos" value={profileSnapshot.projects.length} />
            <SummaryMetric label="Formação" value={profileSnapshot.education.length} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <SummarySection
              title="Contato"
              items={
                contactItems.length > 0
                  ? contactItems
                  : ["Os campos de contato ainda estão vazios no perfil extraído."]
              }
            />
            <SummarySection
              title="Principais habilidades"
              items={
                profileSnapshot.skills.slice(0, 6).map((skill) => {
                  const fragments = [skill.name];
                  if (skill.level) {
                    fragments.push(skill.level);
                  }
                  if (typeof skill.yearsExperience === "number") {
                    fragments.push(`${skill.yearsExperience}y`);
                  }

                  return fragments.join(" • ");
                }) || ["Nenhuma habilidade extraída ainda."]
              }
            />
            <SummarySection
              title="Experiências recentes"
              items={
                profileSnapshot.experiences.slice(0, 4).map((experience) => {
                  const end = experience.endDate ?? "atual";
                  return `${experience.role} na ${experience.company} (${experience.startDate} -> ${end})`;
                }) || ["Nenhuma experiência extraída ainda."]
              }
            />
            <SummarySection
              title="Projetos"
              items={
                profileSnapshot.projects.slice(0, 4).map((project) => project.name) || [
                  "Nenhum projeto extraído ainda.",
                ]
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Arquivos armazenados</CardTitle>
          <CardDescription>
            O PDF master permanece em disco e vira a referência visual atual
            para os currículos gerados nas fases seguintes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 text-base leading-7 text-muted-foreground">
          <div>
            <p className="font-medium text-foreground">Caminho do currículo master</p>
            <p className="break-all">{profileSnapshot.masterResumePath}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Última atualização</p>
            <p>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(profileSnapshot.updatedAt)}</p>
          </div>
          <div>
            <p className="font-medium text-foreground">Links</p>
            <ul className="space-y-1">
              {profileSnapshot.linkedin ? <li>{profileSnapshot.linkedin}</li> : null}
              {profileSnapshot.github ? <li>{profileSnapshot.github}</li> : null}
              {!profileSnapshot.linkedin && !profileSnapshot.github ? (
                <li>Nenhum link de perfil extraído ainda.</li>
              ) : null}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-muted/30 px-5 py-4">
      <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SummarySection({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base font-medium text-foreground">{title}</p>
      <ul className="space-y-3 text-base leading-7 text-muted-foreground">
        {items.map((item) => (
          <li key={`${title}-${item}`} className="rounded-lg border border-border/60 bg-background/60 px-4 py-3">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
