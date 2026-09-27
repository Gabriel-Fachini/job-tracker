"use client";

import { useState, useTransition } from "react";
import type React from "react";
import { Plus, Trash2 } from "lucide-react";

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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { Panel, PanelBody, PanelHeader, PanelTitle } from "@/components/ui/panel";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabBar, TabBarItem } from "@/components/ui/tab-bar";
import { Textarea } from "@/components/ui/textarea";

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

  const masterResumeName = draft.masterResumePath?.split("/").at(-1);

  return (
    <form className="flex flex-col gap-5 pb-28" onSubmit={handleSubmit}>
      <div className="sticky top-0 z-10 -mx-1 border-b border-border bg-background px-1">
        <TabBar aria-label="Editor do perfil" className="border-b-0">
          <TabBarItem
            onClick={() => setActivePanel("profile")}
            selected={activePanel === "profile"}
          >
            Perfil
          </TabBarItem>
          <TabBarItem
            onClick={() => setActivePanel("materials")}
            selected={activePanel === "materials"}
          >
            Materiais
          </TabBarItem>
        </TabBar>

        <div aria-live="polite">
          {result ? (
            <Notice className="pb-3" tone={result.ok ? "positive" : "negative"}>
              {result.ok
                ? "Perfil salvo com sucesso no banco local."
                : result.error}
            </Notice>
          ) : null}
        </div>
      </div>

      {activePanel === "materials" ? (
        <EditorSection
          description="Referência usada para a extração e base visual do currículo."
          title="Currículo master"
        >
          <PanelBody>
            {masterResumeName !== undefined ? (
              <p className="truncate font-data text-sm text-foreground">
                {masterResumeName}
              </p>
            ) : (
              <p className="text-sm text-subtle-foreground">Nenhum arquivo vinculado</p>
            )}
            <p className="mt-2 max-w-[68ch] text-[13px] leading-5 text-pretty text-muted-foreground">
              O arquivo continua salvo localmente em{" "}
              <code className="font-data text-xs text-foreground">
                uploads/resumes/master
              </code>
              . Para trocar o PDF, feche este painel e use o botão de upload da
              página principal.
            </p>
          </PanelBody>
        </EditorSection>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
            <EditorSection
              description="Informações centrais exibidas no cartão principal do perfil."
              title="Informações básicas"
            >
              <PanelBody>
                <FieldSet>
                  <FieldLegend variant="label">Perfil</FieldLegend>
                  <FieldGroup className="grid gap-4 @md/panel:grid-cols-2">
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
                    <Field className="col-span-full">
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
                    <Field data-disabled="true">
                      <FieldLabel htmlFor="profile-timezone">Fuso horário</FieldLabel>
                      <Input
                        className="font-data"
                        disabled
                        id="profile-timezone"
                        value="UTC-3"
                      />
                    </Field>
                    <Field className="col-span-full" data-disabled="true">
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
              </PanelBody>
            </EditorSection>

            <EditorSection
              description="Preferências que ajudam a orientar a seleção e o tom do currículo."
              title="Preferências"
            >
              <PanelBody>
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
              </PanelBody>
            </EditorSection>
          </div>

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
            description="Cargo, contexto e bullets de resultado de cada experiência."
            title="Experiências"
          >
            <ol className="divide-y divide-border">
              {draft.experiences.map((experience, index) => (
                <li className="flex flex-col gap-4 px-4 py-5 sm:px-5" key={experience.clientId}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-foreground">
                      Experiência {index + 1}
                    </h3>
                    <RemoveButton
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          experiences: current.experiences.filter(
                            (item) => item.clientId !== experience.clientId,
                          ),
                        }))
                      }
                    />
                  </div>

                  <FieldGroup className="grid gap-4 @md/panel:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor={`${experience.clientId}-company`}>Empresa</FieldLabel>
                      <Input
                        id={`${experience.clientId}-company`}
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
                      <FieldLabel htmlFor={`${experience.clientId}-role`}>Cargo</FieldLabel>
                      <Input
                        id={`${experience.clientId}-role`}
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
                      <FieldLabel htmlFor={`${experience.clientId}-start`}>Início</FieldLabel>
                      <Input
                        id={`${experience.clientId}-start`}
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
                    <Field data-disabled={experience.isCurrent || undefined}>
                      <FieldLabel htmlFor={`${experience.clientId}-end`}>Fim</FieldLabel>
                      <Input
                        disabled={experience.isCurrent}
                        id={`${experience.clientId}-end`}
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
                      <FieldLabel htmlFor={`${experience.clientId}-status`}>Status</FieldLabel>
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
                        <SelectTrigger className="w-full" id={`${experience.clientId}-status`}>
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
                    <Field className="col-span-full">
                      <FieldLabel htmlFor={`${experience.clientId}-description`}>
                        Descrição
                      </FieldLabel>
                      <Textarea
                        id={`${experience.clientId}-description`}
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

                  {/* Hairline on a wrapper: on the fieldset itself the legend
                      would be drawn over the border. */}
                  <div className="border-t border-border pt-4">
                    <FieldSet className="gap-4">
                      <FieldLegend className="mb-0" variant="label">
                        Bullets de realizações
                      </FieldLegend>
                      <FieldDescription>
                        Mantenha entregas relevantes em frases objetivas.
                      </FieldDescription>

                      <ol className="flex flex-col gap-4">
                        {experience.bullets.map((bullet, bulletIndex) => (
                          <li className="flex flex-col gap-2" key={bullet.clientId}>
                            <div className="flex items-center justify-between gap-3">
                              <FieldLabel htmlFor={`${bullet.clientId}-content`}>
                                Bullet {bulletIndex + 1}
                              </FieldLabel>
                              <RemoveButton
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
                              />
                            </div>
                            <Textarea
                              id={`${bullet.clientId}-content`}
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
                          </li>
                        ))}
                      </ol>

                      <div>
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
                    </FieldSet>
                  </div>
                </li>
              ))}
            </ol>
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
              description="Nome, nível, categoria e anos de experiência de cada habilidade."
              title="Habilidades"
            >
              <ul className="divide-y divide-border">
                {draft.skills.map((skill, index) => (
                  <li className="flex items-end gap-2 px-4 py-4 sm:px-5" key={skill.clientId}>
                    <div className="grid min-w-0 flex-1 gap-3 @md/panel:grid-cols-2 @2xl/panel:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem]">
                      <Field className="gap-1.5">
                        <FieldLabel htmlFor={`${skill.clientId}-name`}>Nome</FieldLabel>
                        <Input
                          id={`${skill.clientId}-name`}
                          onChange={(event) =>
                            updateSkill(skill.clientId, (current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                          value={skill.name}
                        />
                      </Field>
                      <Field className="gap-1.5">
                        <FieldLabel htmlFor={`${skill.clientId}-level`}>Nível</FieldLabel>
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
                          <SelectTrigger className="w-full" id={`${skill.clientId}-level`}>
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
                      <Field className="gap-1.5">
                        <FieldLabel htmlFor={`${skill.clientId}-category`}>Categoria</FieldLabel>
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
                          <SelectTrigger className="w-full" id={`${skill.clientId}-category`}>
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
                      <Field className="gap-1.5">
                        <FieldLabel htmlFor={`${skill.clientId}-years`}>Anos</FieldLabel>
                        <Input
                          className="font-data"
                          id={`${skill.clientId}-years`}
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
                    </div>
                    <RemoveButton
                      iconOnly
                      label={`Remover habilidade ${index + 1}`}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          skills: current.skills.filter(
                            (item) => item.clientId !== skill.clientId,
                          ),
                        }))
                      }
                    />
                  </li>
                ))}
              </ul>
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
                title="Projetos"
              >
                <ol className="divide-y divide-border">
                  {draft.projects.map((project, index) => (
                    <li className="flex flex-col gap-4 px-4 py-5 sm:px-5" key={project.clientId}>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium text-foreground">
                          Projeto {index + 1}
                        </h3>
                        <RemoveButton
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              projects: current.projects.filter(
                                (item) => item.clientId !== project.clientId,
                              ),
                            }))
                          }
                        />
                      </div>

                      <FieldGroup className="grid gap-4 @md/panel:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor={`${project.clientId}-name`}>Nome</FieldLabel>
                          <Input
                            id={`${project.clientId}-name`}
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
                          <FieldLabel htmlFor={`${project.clientId}-url`}>Link</FieldLabel>
                          <Input
                            id={`${project.clientId}-url`}
                            onChange={(event) =>
                              updateProject(project.clientId, (current) => ({
                                ...current,
                                url: event.target.value,
                              }))
                            }
                            value={project.url}
                          />
                        </Field>
                        <Field className="col-span-full">
                          <FieldLabel htmlFor={`${project.clientId}-stack`}>Stack</FieldLabel>
                          <Input
                            id={`${project.clientId}-stack`}
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
                        <Field className="col-span-full">
                          <FieldLabel htmlFor={`${project.clientId}-description`}>
                            Descrição
                          </FieldLabel>
                          <Textarea
                            id={`${project.clientId}-description`}
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
                        <Field className="col-span-full">
                          <FieldLabel htmlFor={`${project.clientId}-impact`}>Impacto</FieldLabel>
                          <Textarea
                            id={`${project.clientId}-impact`}
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
                    </li>
                  ))}
                </ol>
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
                title="Formação"
              >
                <ol className="divide-y divide-border">
                  {draft.education.map((education, index) => (
                    <li className="flex flex-col gap-4 px-4 py-5 sm:px-5" key={education.clientId}>
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-medium text-foreground">
                          Formação {index + 1}
                        </h3>
                        <RemoveButton
                          onClick={() =>
                            setDraft((current) => ({
                              ...current,
                              education: current.education.filter(
                                (item) => item.clientId !== education.clientId,
                              ),
                            }))
                          }
                        />
                      </div>

                      <FieldGroup className="grid gap-4 @md/panel:grid-cols-2">
                        <Field>
                          <FieldLabel htmlFor={`${education.clientId}-institution`}>
                            Instituição
                          </FieldLabel>
                          <Input
                            id={`${education.clientId}-institution`}
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
                          <FieldLabel htmlFor={`${education.clientId}-degree`}>
                            Curso ou grau
                          </FieldLabel>
                          <Input
                            id={`${education.clientId}-degree`}
                            onChange={(event) =>
                              updateEducation(education.clientId, (current) => ({
                                ...current,
                                degree: event.target.value,
                              }))
                            }
                            value={education.degree}
                          />
                        </Field>
                        <Field className="col-span-full">
                          <FieldLabel htmlFor={`${education.clientId}-field`}>Área</FieldLabel>
                          <Input
                            id={`${education.clientId}-field`}
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
                          <FieldLabel htmlFor={`${education.clientId}-start`}>Início</FieldLabel>
                          <Input
                            id={`${education.clientId}-start`}
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
                        <Field>
                          <FieldLabel htmlFor={`${education.clientId}-end`}>Fim</FieldLabel>
                          <Input
                            id={`${education.clientId}-end`}
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
                      </FieldGroup>
                    </li>
                  ))}
                </ol>
              </EditorSection>
            </div>
          </div>
        </>
      )}

      <div className="sticky bottom-0 z-20 -mx-1 flex gap-2 border-t border-border bg-background px-1 pt-3 pb-4 sm:justify-end">
        <Button
          className="flex-1 sm:flex-none"
          onClick={onCancel}
          type="button"
          variant="ghost"
        >
          Cancelar
        </Button>
        <Button className="flex-1 sm:flex-none" disabled={isPending} type="submit">
          {isPending ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}

function EditorSection({
  action,
  children,
  description,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Panel className="@container/panel overflow-hidden">
      <PanelHeader className="flex-wrap items-start py-3">
        <div className="min-w-0 flex-1 basis-56">
          <PanelTitle>{title}</PanelTitle>
          <p className="mt-0.5 text-[13px] text-pretty text-muted-foreground">
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </PanelHeader>
      {children}
    </Panel>
  );
}

/**
 * Remove control. Rows with visible labels get the worded ghost button;
 * dense rows (skills) pass `iconOnly` with an explicit label.
 */
function RemoveButton({
  iconOnly = false,
  label,
  onClick,
}: {
  iconOnly?: boolean;
  label?: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className={cn(
        "shrink-0 hover:bg-negative/10 hover:text-negative",
        !iconOnly && "-mr-2",
      )}
      onClick={onClick}
      size={iconOnly ? "icon" : "sm"}
      type="button"
      variant="ghost"
    >
      <Trash2 data-icon={iconOnly ? undefined : "inline-start"} />
      {iconOnly ? null : "Remover"}
    </Button>
  );
}
