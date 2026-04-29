"use client";

import { useState } from "react";
import { Cormorant_Garamond } from "next/font/google";
import { FilePenLine, FileUp, Sparkles } from "lucide-react";

import type { ProfileSnapshot } from "@/lib/profile/editor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProfileSummary } from "@/components/profile/profile-summary";
import { ProfileUploadPanel } from "@/components/profile/profile-upload-panel";

const profileDisplay = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-profile-display",
  weight: ["400", "500", "600", "700"],
});

type ProfileWorkspaceProps = {
  profileSnapshot: ProfileSnapshot | null;
};

export function ProfileWorkspace({ profileSnapshot }: ProfileWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<
    "basics" | "links" | "preferences" | "experiences" | "skills" | "education" | null
  >(null);

  return (
    <div
      className={`${profileDisplay.variable} relative flex flex-col gap-6 text-stone-100`}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(72,161,108,0.16),transparent_32%),radial-gradient(circle_at_85%_14%,rgba(35,96,67,0.22),transparent_26%),linear-gradient(180deg,rgba(10,10,10,0.08),transparent_20%)]" />

      <header className="flex flex-col gap-6 px-3 py-2 sm:px-1">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-3xl flex-col gap-2">
            <h1 className="font-[family:var(--font-profile-display)] text-[3.2rem] leading-none text-stone-50 sm:text-[4rem]">
              Meu perfil
            </h1>
            <p className="max-w-2xl text-[1.02rem] leading-8 text-stone-400">
              Seu perfil profissional e materiais principais.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <ProfileUploadPanel />

            {profileSnapshot ? (
              <Button
                className="h-11 w-full items-center justify-center gap-2 rounded-[1rem] border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(54,117,84,0.95),rgba(42,96,68,0.92))] px-5 text-emerald-50 hover:bg-[linear-gradient(180deg,rgba(61,129,92,0.98),rgba(46,105,74,0.95))] sm:w-auto"
                onClick={() => setActiveSection("basics")}
                size="lg"
                type="button"
              >
                  <FilePenLine data-icon="inline-start" />
                  Editar perfil
              </Button>
            ) : null}
          </div>
        </div>

        {profileSnapshot ? (
          <div className="flex flex-wrap items-center gap-3 text-sm text-stone-400">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/18 bg-emerald-500/6 px-3 py-1.5 text-emerald-200">
              <Sparkles className="size-4 text-emerald-300" />
              Edição inline por seção disponível
            </span>
            <span>
              Atualizado em{" "}
              {new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(profileSnapshot.updatedAt)}
            </span>
          </div>
        ) : (
          <Card className="border-white/8 bg-[linear-gradient(180deg,rgba(31,31,31,0.95),rgba(24,24,24,0.98))] shadow-none">
            <CardHeader>
              <CardTitle className="font-[family:var(--font-profile-display)] text-3xl text-stone-50">
                Nenhum perfil carregado ainda
              </CardTitle>
              <CardDescription className="text-stone-400">
                Envie o currículo master em PDF para iniciar a extração local e
                construir a base do seu perfil.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3 text-sm text-stone-400">
                <FileUp className="size-4" />
                O fluxo continua local-first e o formulário de revisão aparece
                depois da primeira extração.
              </div>
            </CardContent>
          </Card>
        )}
      </header>

      <ProfileSummary
        activeSection={activeSection}
        key={profileSnapshot ? `${profileSnapshot.id}-${profileSnapshot.updatedAt.toISOString()}` : "empty"}
        onActiveSectionChange={setActiveSection}
        profileSnapshot={profileSnapshot}
      />
    </div>
  );
}
