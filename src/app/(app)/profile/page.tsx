import { ProfileSummary } from "@/components/profile/profile-summary";
import { ProfileUploadPanel } from "@/components/profile/profile-upload-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfileSnapshot } from "@/lib/profile/queries";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profileSnapshot = await getProfileSnapshot();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">
          Fase 2.3
        </p>
        <div className="flex flex-col gap-3">
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Perfil profissional
          </h1>
          <p className="max-w-4xl text-base leading-8 text-muted-foreground sm:text-lg">
            Upload do currículo master em PDF, extração no servidor e
            persistência do perfil estruturado usando apenas o runtime local.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <ProfileUploadPanel />

        <Card size="sm">
          <CardHeader>
            <CardTitle>Escopo ativo desta fase</CardTitle>
            <CardDescription>
              O recorte atual fecha o fluxo principal local-first e deixa a
              comparação remota fora da interface.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-base leading-7 text-muted-foreground">
            <p>1. Recebe o PDF do currículo master.</p>
            <p>2. Salva o arquivo em uploads/resumes/master.</p>
            <p>3. Extrai o texto no servidor e chama o modelo local.</p>
            <p>4. Persiste o perfil único no SQLite para a revisão da fase 2.4.</p>
          </CardContent>
        </Card>
      </div>

      <ProfileSummary profileSnapshot={profileSnapshot} />
    </div>
  );
}
