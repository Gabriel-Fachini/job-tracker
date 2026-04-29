"use client";

import { useState, useTransition } from "react";
import type React from "react";
import { Cormorant_Garamond } from "next/font/google";
import {
  BriefcaseBusiness,
  FolderKanban,
  GraduationCap,
  LoaderCircle,
  Plus,
  Save,
  Sparkles,
  Trash2,
  UserRound,
  Wrench,
} from "lucide-react";

import {
  createEmptyBullet,
  createEmptyEducation,
  createEmptyExperience,
  createEmptyProject,
  createEmptySkill,
  createProfileReviewData,
  type ProfileReviewData,
  type ProfileReviewEducation,
  type ProfileReviewExperience,
  type ProfileReviewProject,
  type ProfileReviewSkill,
  type ProfileSnapshot,
  SKILL_CATEGORY_OPTIONS,
  SKILL_LEVEL_OPTIONS,
  WORK_MODEL_OPTIONS,
} from "@/lib/profile/editor";
import { updateProfile, type UpdateProfileActionResult } from "@/server/actions/profile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const profileDisplay = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-profile-display",
  weight: ["400", "500", "600", "700"],
});

type ProfileReviewFormProps = {
  onCancel?: () => void;
  profileSnapshot: ProfileSnapshot;
};

export function ProfileReviewForm({
  onCancel,
  profileSnapshot,
}: ProfileReviewFormProps) {
  const [draft, setDraft] = useState<ProfileReviewData>(() =>
    createProfileReviewData(profileSnapshot),
  );
  const [result, setResult] = useState<UpdateProfileActionResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activePanel, setActivePanel] = useState<"profile" | "materials">(
    "profile",
  );

  function updateRootField<Key extends keyof ProfileReviewData>(
    key: Key,
    value: ProfileReviewData[Key],
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateExperience(
    experienceId: string,
    updater: (experience: ProfileReviewExperience) => ProfileReviewExperience,
  ) {
    setDraft((current) => ({
      ...current,
      experiences: current.experiences.map((experience) =>
        experience.clientId === experienceId ? updater(experience) : experience,
      ),
    }));
  }

  function updateSkill(
    skillId: string,
    updater: (skill: ProfileReviewSkill) => ProfileReviewSkill,
  ) {
    setDraft((current) => ({
      ...current,
      skills: current.skills.map((skill) =>
        skill.clientId === skillId ? updater(skill) : skill,
      ),
    }));
  }

  function updateProject(
    projectId: string,
    updater: (project: ProfileReviewProject) => ProfileReviewProject,
  ) {
    setDraft((current) => ({
      ...current,
      projects: current.projects.map((project) =>
        project.clientId === projectId ? updater(project) : project,
      ),
    }));
  }

  function updateEducation(
    educationId: string,
    updater: (education: ProfileReviewEducation) => ProfileReviewEducation,
  ) {
    setDraft((current) => ({
      ...current,
      education: current.education.map((education) =>
        education.clientId === educationId ? updater(education) : education,
      ),
    }));
  }

  function updateHeroRole(value: string) {
    setDraft((current) => {
      if (current.experiences.length === 0) {
        return {
          ...current,
          experiences: [{ ...createEmptyExperience(), role: value }],
        };
      }

      return {
        ...current,
        experiences: current.experiences.map((experience, index) =>
          index === 0 ? { ...experience, role: value } : experience,
        ),
      };
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(null);

    startTransition(async () => {
      const nextResult = await updateProfile(draft);
      setResult(nextResult);
    });
  }

  return (
    <form
      className={`${profileDisplay.variable} flex flex-col gap-5 pb-28`}
      onSubmit={handleSubmit}
    >
      <div className="sticky top-0 z-10 -mx-1 rounded-[1.2rem] border border-white/8 bg-[rgba(24,23,22,0.88)] px-3 py-3 shadow-[0_18px_34px_rgba(0,0,0,0.24)] supports-backdrop-filter:backdrop-blur">
        <div className="grid grid-cols-2 gap-2">
          <button
            className={cn(
              "rounded-[0.9rem] border-b px-3 py-2 text-sm transition-colors",
              activePanel === "profile"
                ? "border-[rgba(214,182,96,0.85)] text-[oklch(0.82_0.08_82)]"
                : "border-transparent text-stone-400 hover:text-stone-200",
            )}
            onClick={() => setActivePanel("profile")}
            type="button"
          >
            Perfil
          </button>
          <button
            className={cn(
              "rounded-[0.9rem] border-b px-3 py-2 text-sm transition-colors",
              activePanel === "materials"
                ? "border-[rgba(214,182,96,0.85)] text-[oklch(0.82_0.08_82)]"
                : "border-transparent text-stone-400 hover:text-stone-200",
            )}
            onClick={() => setActivePanel("materials")}
            type="button"
          >
            Materiais
          </button>
        </div>

        {result ? (
          <p
            aria-live="polite"
            className={cn(
              "mt-3 text-sm",
              result.ok ? "text-[oklch(0.79_0.12_149)]" : "text-red-300",
            )}
          >
            {result.ok
              ? "Perfil salvo com sucesso no banco local."
              : result.error}
          </p>
        ) : null}
      </div>

      {activePanel === "materials" ? (
        <div className="space-y-4">
          <EditorSection
            description="Referência usada para a extração e base visual do currículo."
            icon={FolderKanban}
            title="Currículo master"
          >
            <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4">
              <p className="text-sm font-medium text-stone-100">
                {draft.masterResumePath?.split("/").at(-1) ??
                  "Nenhum arquivo vinculado"}
              </p>
              <p className="mt-2 text-sm leading-7 text-stone-400">
                O arquivo continua salvo localmente em `uploads/resumes/master`.
                Para trocar o PDF, feche este painel e use o botão de upload da
                página principal.
              </p>
            </div>
          </EditorSection>
        </div>
      ) : (
        <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
        <EditorSection
          description="Informações centrais exibidas no cartão principal do perfil."
          icon={UserRound}
          title="Informações básicas"
        >
          <FieldSet>
            <FieldLegend variant="label">Perfil</FieldLegend>
            <FieldGroup className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="profile-full-name">Nome completo</FieldLabel>
                <Input
                  autoComplete="name"
                  id="profile-full-name"
                  name="fullName"
                  onChange={(event) => updateRootField("fullName", event.target.value)}
                  required
                  value={draft.fullName}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-headline">Cargo atual</FieldLabel>
                <Input
                  id="profile-headline"
                  onChange={(event) => updateHeroRole(event.target.value)}
                  value={draft.experiences[0]?.role ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-location">Localização</FieldLabel>
                <Input
                  autoComplete="address-level2"
                  id="profile-location"
                  name="location"
                  onChange={(event) => updateRootField("location", event.target.value)}
                  value={draft.location}
                />
              </Field>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="profile-about">Sobre você</FieldLabel>
                <Textarea
                  id="profile-about"
                  onChange={(event) => updateRootField("notes", event.target.value)}
                  rows={5}
                  value={draft.notes}
                />
                <FieldDescription>
                  Use este texto como resumo principal exibido na página.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-email">Email</FieldLabel>
                <Input
                  autoComplete="email"
                  id="profile-email"
                  name="email"
                  onChange={(event) => updateRootField("email", event.target.value)}
                  type="email"
                  value={draft.email}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-phone">Telefone</FieldLabel>
                <Input
                  autoComplete="tel"
                  id="profile-phone"
                  name="phone"
                  onChange={(event) => updateRootField("phone", event.target.value)}
                  value={draft.phone}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-timezone">Fuso horário</FieldLabel>
                <Input
                  disabled
                  id="profile-timezone"
                  value="UTC-3"
                />
              </Field>
              <Field className="md:col-span-2">
                <FieldLabel htmlFor="profile-languages">Idiomas</FieldLabel>
                <Input
                  disabled
                  id="profile-languages"
                  value="Idiomas não informados"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-linkedin">LinkedIn</FieldLabel>
                <Input
                  autoComplete="url"
                  id="profile-linkedin"
                  name="linkedin"
                  onChange={(event) => updateRootField("linkedin", event.target.value)}
                  value={draft.linkedin}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-github">GitHub</FieldLabel>
                <Input
                  autoComplete="url"
                  id="profile-github"
                  name="github"
                  onChange={(event) => updateRootField("github", event.target.value)}
                  value={draft.github}
                />
              </Field>
            </FieldGroup>
          </FieldSet>
        </EditorSection>

        <EditorSection
          description="Preferências que ajudam a orientar a seleção e o tom do currículo."
          icon={Sparkles}
          title="Preferências"
        >
          <FieldSet>
            <FieldLegend variant="label">Direção profissional</FieldLegend>
            <FieldGroup className="grid gap-4">
              <Field>
                <FieldLabel htmlFor="profile-work-model">Modelo de trabalho</FieldLabel>
                <Select
                  items={WORK_MODEL_OPTIONS}
                  onValueChange={(value) =>
                    updateRootField("workModelPreference", value ?? "")
                  }
                  value={draft.workModelPreference || undefined}
                >
                  <SelectTrigger className="w-full" id="profile-work-model">
                    <SelectValue placeholder="Selecione uma preferência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {WORK_MODEL_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-company-type">Tipo de empresa</FieldLabel>
                <Input
                  id="profile-company-type"
                  name="companyTypePreference"
                  onChange={(event) =>
                    updateRootField("companyTypePreference", event.target.value)
                  }
                  placeholder="Ex.: startup enxuta, fintech, produto B2B"
                  value={draft.companyTypePreference}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-values">Valores e missão</FieldLabel>
                <Textarea
                  id="profile-values"
                  name="valuesPreference"
                  onChange={(event) =>
                    updateRootField("valuesPreference", event.target.value)
                  }
                  placeholder="Ex.: clareza, autonomia, produto com impacto real"
                  rows={4}
                  value={draft.valuesPreference}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-notes">Observações gerais</FieldLabel>
                <Textarea
                  id="profile-notes"
                  name="notes"
                  onChange={(event) => updateRootField("notes", event.target.value)}
                  placeholder="Notas livres que ajudam nas próximas decisões de fit e currículo."
                  rows={5}
                  value={draft.notes}
                />
                <FieldDescription>
                  Use esse espaço para registrar nuances que a extração não
                  capturou bem.
                </FieldDescription>
              </Field>
            </FieldGroup>
          </FieldSet>
          </EditorSection>
        </div>
        </>
      )}

      {activePanel === "profile" ? (
        <>

      <EditorSection
        action={
          <Button
            onClick={() =>
              setDraft((current) => ({
                ...current,
                experiences: [...current.experiences, createEmptyExperience()],
              }))
            }
            size="sm"
            type="button"
            variant="outline"
          >
            <Plus data-icon="inline-start" />
            Adicionar experiência
          </Button>
        }
        description="Use cards completos apenas onde a estrutura do conteúdo é mais densa."
        icon={BriefcaseBusiness}
        title="Experiências"
      >
        <div className="flex flex-col gap-4">
          {draft.experiences.map((experience, index) => (
            <Card key={experience.clientId} size="sm">
              <CardHeader className="gap-3 border-b">
                <div className="flex flex-col gap-1">
                  <CardTitle>Experiência {index + 1}</CardTitle>
                  <CardDescription>
                    Cargo, contexto e bullets de resultado.
                  </CardDescription>
                </div>
                <Button
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      experiences: current.experiences.filter(
                        (item) => item.clientId !== experience.clientId,
                      ),
                    }))
                  }
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 data-icon="inline-start" />
                  Remover
                </Button>
              </CardHeader>
              <CardContent className="flex flex-col gap-5 pt-4">
                <FieldGroup className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel>Empresa</FieldLabel>
                    <Input
                      onChange={(event) =>
                        updateExperience(experience.clientId, (current) => ({
                          ...current,
                          company: event.target.value,
                        }))
                      }
                      value={experience.company}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Cargo</FieldLabel>
                    <Input
                      onChange={(event) =>
                        updateExperience(experience.clientId, (current) => ({
                          ...current,
                          role: event.target.value,
                        }))
                      }
                      value={experience.role}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Início</FieldLabel>
                    <Input
                      onChange={(event) =>
                        updateExperience(experience.clientId, (current) => ({
                          ...current,
                          startDate: event.target.value,
                        }))
                      }
                      type="month"
                      value={experience.startDate}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Fim</FieldLabel>
                    <Input
                      disabled={experience.isCurrent}
                      onChange={(event) =>
                        updateExperience(experience.clientId, (current) => ({
                          ...current,
                          endDate: event.target.value,
                        }))
                      }
                      type="month"
                      value={experience.endDate}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Status</FieldLabel>
                    <Select
                      items={[
                        { label: "Em andamento", value: "current" },
                        { label: "Encerrada", value: "closed" },
                      ]}
                      onValueChange={(value) =>
                        updateExperience(experience.clientId, (current) => ({
                          ...current,
                          isCurrent: value === "current",
                          endDate: value === "current" ? "" : current.endDate,
                        }))
                      }
                      value={experience.isCurrent ? "current" : "closed"}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value="current">Em andamento</SelectItem>
                          <SelectItem value="closed">Encerrada</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field className="md:col-span-2">
                    <FieldLabel>Descrição</FieldLabel>
                    <Textarea
                      onChange={(event) =>
                        updateExperience(experience.clientId, (current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      rows={3}
                      value={experience.description}
                    />
                  </Field>
                </FieldGroup>

                <div className="flex flex-col gap-3 rounded-[1.3rem] border border-border/70 bg-background/40 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Bullets de realizações
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Mantenha entregas relevantes em frases objetivas.
                      </p>
                    </div>
                    <Button
                      onClick={() =>
                        updateExperience(experience.clientId, (current) => ({
                          ...current,
                          bullets: [...current.bullets, createEmptyBullet()],
                        }))
                      }
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      <Plus data-icon="inline-start" />
                      Adicionar bullet
                    </Button>
                  </div>

                  <div className="flex flex-col gap-3">
                    {experience.bullets.map((bullet, bulletIndex) => (
                      <div
                        className="rounded-2xl border border-border/60 bg-card/70 px-3 py-3"
                        key={bullet.clientId}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-foreground">
                            Bullet {bulletIndex + 1}
                          </p>
                          <Button
                            onClick={() =>
                              updateExperience(experience.clientId, (current) => ({
                                ...current,
                                bullets:
                                  current.bullets.length > 1
                                    ? current.bullets.filter(
                                        (item) => item.clientId !== bullet.clientId,
                                      )
                                    : [createEmptyBullet()],
                              }))
                            }
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 data-icon="inline-start" />
                            Remover
                          </Button>
                        </div>
                        <Textarea
                          onChange={(event) =>
                            updateExperience(experience.clientId, (current) => ({
                              ...current,
                              bullets: current.bullets.map((item) =>
                                item.clientId === bullet.clientId
                                  ? { ...item, content: event.target.value }
                                  : item,
                              ),
                            }))
                          }
                          rows={3}
                          value={bullet.content}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </EditorSection>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
        <EditorSection
          action={
            <Button
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  skills: [...current.skills, createEmptySkill()],
                }))
              }
              size="sm"
              type="button"
              variant="outline"
            >
              <Plus data-icon="inline-start" />
              Adicionar habilidade
            </Button>
          }
          description="Lista compacta para evitar dezenas de cards quase idênticos."
          icon={Wrench}
          title="Habilidades"
        >
          <div className="flex flex-col gap-3">
            {draft.skills.map((skill, index) => (
              <div
                className="grid gap-3 rounded-[1.35rem] border border-border/70 bg-background/45 px-4 py-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_120px_auto]"
                key={skill.clientId}
              >
                <Field className="gap-1">
                  <FieldLabel>Nome</FieldLabel>
                  <Input
                    onChange={(event) =>
                      updateSkill(skill.clientId, (current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    value={skill.name}
                  />
                </Field>
                <Field className="gap-1">
                  <FieldLabel>Nível</FieldLabel>
                  <Select
                    items={SKILL_LEVEL_OPTIONS}
                    onValueChange={(value) =>
                      updateSkill(skill.clientId, (current) => ({
                        ...current,
                        level: value ?? "",
                      }))
                    }
                    value={skill.level || undefined}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {SKILL_LEVEL_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="gap-1">
                  <FieldLabel>Categoria</FieldLabel>
                  <Select
                    items={SKILL_CATEGORY_OPTIONS}
                    onValueChange={(value) =>
                      updateSkill(skill.clientId, (current) => ({
                        ...current,
                        category: value ?? "",
                      }))
                    }
                    value={skill.category || undefined}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {SKILL_CATEGORY_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field className="gap-1">
                  <FieldLabel>Anos</FieldLabel>
                  <Input
                    min={0}
                    onChange={(event) =>
                      updateSkill(skill.clientId, (current) => ({
                        ...current,
                        yearsExperience: event.target.value,
                      }))
                    }
                    step={1}
                    type="number"
                    value={skill.yearsExperience}
                  />
                </Field>
                <div className="flex items-end justify-end">
                  <Button
                    aria-label={`Remover habilidade ${index + 1}`}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        skills: current.skills.filter(
                          (item) => item.clientId !== skill.clientId,
                        ),
                      }))
                    }
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </EditorSection>

        <div className="grid gap-5">
          <EditorSection
            action={
              <Button
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    projects: [...current.projects, createEmptyProject()],
                  }))
                }
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus data-icon="inline-start" />
                Adicionar projeto
              </Button>
            }
            description="Projetos pessoais podem permanecer mais compactos até você precisar detalhar."
            icon={FolderKanban}
            title="Projetos"
          >
            <div className="flex flex-col gap-3">
              {draft.projects.map((project, index) => (
                <div
                  className="rounded-[1.35rem] border border-border/70 bg-background/45 px-4 py-4"
                  key={project.clientId}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Projeto {index + 1}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Nome, link, stack e impacto.
                      </p>
                    </div>
                    <Button
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          projects: current.projects.filter(
                            (item) => item.clientId !== project.clientId,
                          ),
                        }))
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 data-icon="inline-start" />
                      Remover
                    </Button>
                  </div>

                  <FieldGroup className="grid gap-3">
                    <Field>
                      <FieldLabel>Nome</FieldLabel>
                      <Input
                        onChange={(event) =>
                          updateProject(project.clientId, (current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        value={project.name}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Link</FieldLabel>
                      <Input
                        onChange={(event) =>
                          updateProject(project.clientId, (current) => ({
                            ...current,
                            url: event.target.value,
                          }))
                        }
                        value={project.url}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Stack</FieldLabel>
                      <Input
                        onChange={(event) =>
                          updateProject(project.clientId, (current) => ({
                            ...current,
                            stack: event.target.value,
                          }))
                        }
                        placeholder="Ex.: Next.js, TypeScript, SQLite"
                        value={project.stack}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Descrição</FieldLabel>
                      <Textarea
                        onChange={(event) =>
                          updateProject(project.clientId, (current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        rows={3}
                        value={project.description}
                      />
                    </Field>
                    <Field>
                      <FieldLabel>Impacto</FieldLabel>
                      <Textarea
                        onChange={(event) =>
                          updateProject(project.clientId, (current) => ({
                            ...current,
                            impact: event.target.value,
                          }))
                        }
                        rows={3}
                        value={project.impact}
                      />
                    </Field>
                  </FieldGroup>
                </div>
              ))}
            </div>
          </EditorSection>

          <EditorSection
            action={
              <Button
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    education: [...current.education, createEmptyEducation()],
                  }))
                }
                size="sm"
                type="button"
                variant="outline"
              >
                <Plus data-icon="inline-start" />
                Adicionar formação
              </Button>
            }
            description="Formação em linhas curtas, suficiente para revisão rápida."
            icon={GraduationCap}
            title="Formação"
          >
            <div className="flex flex-col gap-3">
              {draft.education.map((education, index) => (
                <div
                  className="grid gap-3 rounded-[1.35rem] border border-border/70 bg-background/45 px-4 py-4 md:grid-cols-2"
                  key={education.clientId}
                >
                  <div className="md:col-span-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Formação {index + 1}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Instituição, curso e período.
                      </p>
                    </div>
                    <Button
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          education: current.education.filter(
                            (item) => item.clientId !== education.clientId,
                          ),
                        }))
                      }
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 data-icon="inline-start" />
                      Remover
                    </Button>
                  </div>

                  <Field>
                    <FieldLabel>Instituição</FieldLabel>
                    <Input
                      onChange={(event) =>
                        updateEducation(education.clientId, (current) => ({
                          ...current,
                          institution: event.target.value,
                        }))
                      }
                      value={education.institution}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Curso ou grau</FieldLabel>
                    <Input
                      onChange={(event) =>
                        updateEducation(education.clientId, (current) => ({
                          ...current,
                          degree: event.target.value,
                        }))
                      }
                      value={education.degree}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Área</FieldLabel>
                    <Input
                      onChange={(event) =>
                        updateEducation(education.clientId, (current) => ({
                          ...current,
                          field: event.target.value,
                        }))
                      }
                      value={education.field}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Início</FieldLabel>
                    <Input
                      onChange={(event) =>
                        updateEducation(education.clientId, (current) => ({
                          ...current,
                          startDate: event.target.value,
                        }))
                      }
                      type="month"
                      value={education.startDate}
                    />
                  </Field>
                  <Field className="md:col-span-2">
                    <FieldLabel>Fim</FieldLabel>
                    <Input
                      onChange={(event) =>
                        updateEducation(education.clientId, (current) => ({
                          ...current,
                          endDate: event.target.value,
                        }))
                      }
                      type="month"
                      value={education.endDate}
                    />
                  </Field>
                </div>
              ))}
            </div>
          </EditorSection>
        </div>
      </div>
        </>
      ) : null}

      <div className="sticky bottom-0 z-20 -mx-1 flex gap-3 border-t border-white/8 bg-[linear-gradient(180deg,rgba(23,22,21,0.2),rgba(23,22,21,0.95)_35%)] px-1 pb-5 pt-4 supports-backdrop-filter:backdrop-blur">
        <Button
          className="h-11 flex-1 rounded-[1rem] border border-white/12 bg-transparent text-stone-100 hover:bg-white/[0.04]"
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancelar
        </Button>
        <Button
          className="h-11 flex-1 rounded-[1rem] border border-[rgba(214,182,96,0.4)] bg-[linear-gradient(180deg,rgba(206,169,76,0.96),rgba(177,143,61,0.92))] text-stone-950 hover:bg-[linear-gradient(180deg,rgba(216,182,91,1),rgba(185,151,67,0.96))]"
          disabled={isPending}
          type="submit"
        >
          {isPending ? (
            <LoaderCircle className="animate-spin" data-icon="inline-start" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          {isPending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}

function EditorSection({
  action,
  children,
  description,
  icon: Icon,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description: string;
  icon: React.ComponentType<React.ComponentProps<"svg">>;
  title: string;
}) {
  return (
    <Card className="border-white/8 bg-[linear-gradient(180deg,rgba(31,31,31,0.95),rgba(25,25,25,0.98))] shadow-none">
      <CardHeader className="gap-3 border-b border-white/8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-[oklch(0.85_0.03_96)]">
              <Icon />
            </div>
            <div className="flex flex-col gap-1">
              <CardTitle className="font-[family:var(--font-profile-display)] text-[2rem] leading-none text-stone-100">
                {title}
              </CardTitle>
              <CardDescription className="text-stone-400">
                {description}
              </CardDescription>
            </div>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}
