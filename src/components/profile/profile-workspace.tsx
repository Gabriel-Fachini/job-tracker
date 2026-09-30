"use client";

import { useState } from "react";
import { FilePenLine, FileUp } from "lucide-react";

import type { ProfileSnapshot } from "@/lib/profile/editor";
import type { SearchPreferences } from "@/lib/search-preferences";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Panel, PanelTitle } from "@/components/ui/panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProfileSummary } from "@/components/profile/profile-summary";
import { ProfileUploadPanel } from "@/components/profile/profile-upload-panel";
import { SearchPreferencesPanel } from "@/components/profile/search-preferences-panel";

type ProfileWorkspaceProps = {
  profileSnapshot: ProfileSnapshot | null;
  searchPreferences: SearchPreferences | null;
};

export function ProfileWorkspace({ profileSnapshot, searchPreferences }: ProfileWorkspaceProps) {
  const [activeSection, setActiveSection] = useState<
    | "basics"
    | "links"
    | "preferences"
    | "experiences"
    | "skills"
    | "projects"
    | "education"
    | null
  >(null);
  // One panel in edit mode at a time: a profile section or the search preferences.
  const [editingSearch, setEditingSearch] = useState(false);
  const isEditing = activeSection !== null || editingSearch;

  return (
    <div className="flex flex-1 flex-col gap-5 sm:gap-6">
      <PageHeader
        title="Perfil"
        description={
          profileSnapshot ? (
            <>
              Atualizado em{" "}
              <time dateTime={profileSnapshot.updatedAt.toISOString()}>
                {new Intl.DateTimeFormat("pt-BR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(profileSnapshot.updatedAt)}
              </time>
            </>
          ) : undefined
        }
        actions={
          profileSnapshot ? (
            <>
              <ProfileUploadPanel />
              {/* While a section is being edited its Salvar is the primary action. */}
              <Button
                disabled={editingSearch}
                onClick={() => setActiveSection("basics")}
                type="button"
                variant={isEditing ? "outline" : "default"}
              >
                <FilePenLine data-icon="inline-start" />
                <span className="sm:hidden">Editar</span>
                <span className="hidden sm:inline">Editar perfil</span>
              </Button>
            </>
          ) : undefined
        }
      />

      {profileSnapshot ? null : (
        <Panel>
          <Empty className="py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileUp />
              </EmptyMedia>
              <EmptyTitle>Nenhum perfil carregado ainda</EmptyTitle>
              <EmptyDescription>
                Envie o currículo master em PDF para iniciar a extração local e
                construir a base do seu perfil. Depois da primeira extração,
                cada seção pode ser revisada e editada aqui.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <ProfileUploadPanel hasProfile={false} />
            </EmptyContent>
          </Empty>
        </Panel>
      )}

      <ProfileSummary
        activeSection={activeSection}
        key={profileSnapshot ? `${profileSnapshot.id}-${profileSnapshot.updatedAt.toISOString()}` : "empty"}
        locked={editingSearch}
        onActiveSectionChange={setActiveSection}
        profileSnapshot={profileSnapshot}
      />

      <SearchPreferencesPanel
        editing={editingSearch}
        key={searchPreferences?.updatedAt?.toISOString() ?? "empty"}
        locked={activeSection !== null}
        onEditingChange={setEditingSearch}
        preferences={searchPreferences}
      />

      {/* The sidebar holds the same control; phones only reach it here. */}
      <Panel
        aria-labelledby="appearance-title"
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
      >
        <div className="min-w-0">
          <PanelTitle id="appearance-title">Aparência</PanelTitle>
          <p className="text-[13px] text-muted-foreground">
            Tema da interface neste dispositivo.
          </p>
        </div>
        <ThemeToggle showLabels />
      </Panel>
    </div>
  );
}
