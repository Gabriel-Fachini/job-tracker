"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
} from "lucide-react";

import {
  createEmptyBullet,
  createEmptyEducation,
  createEmptyExperience,
  createEmptyProject,
  createEmptySkill,
  createProfileReviewData,
  SKILL_CATEGORY_OPTIONS,
  SKILL_LEVEL_OPTIONS,
  type ProfileReviewData,
  type ProfileSnapshot,
  WORK_MODEL_OPTIONS,
} from "@/lib/profile/editor";
import { updateProfile } from "@/server/actions/profile";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MetaLine } from "@/components/ui/meta-line";
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
import { Textarea } from "@/components/ui/textarea";

type EditableSection =
  | "basics"
  | "links"
  | "preferences"
  | "experiences"
  | "skills"
  | "projects"
  | "education";

const sectionLabels: Record<EditableSection, string> = {
  basics: "dados básicos",
  links: "links",
  preferences: "preferências",
  experiences: "experiências",
  skills: "habilidades",
  projects: "projetos",
  education: "formação",
};

type ProfileSummaryProps = {
  activeSection: EditableSection | null;
  onActiveSectionChange: (section: EditableSection | null) => void;
  profileSnapshot: ProfileSnapshot | null;
};

export function ProfileSummary({
  activeSection,
  onActiveSectionChange,
  profileSnapshot,
}: ProfileSummaryProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProfileReviewData | null>(() =>
    profileSnapshot ? createProfileReviewData(profileSnapshot) : null,
  );
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [expandedExperiences, setExpandedExperiences] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  if (!profileSnapshot || !draft) {
    return null;
  }

  const snapshot = profileSnapshot;

  const currentExperience =
    draft.experiences.find((experience) => experience.isCurrent) ??
    draft.experiences[0] ??
    null;

  const heroTags = Array.from(
    new Set([
      ...draft.skills.slice(0, 4).map((skill) => skill.name.trim()),
      ...draft.experiences
        .flatMap((experience) =>
          experience.bullets.flatMap((bullet) => bullet.tags.map((tag) => tag.trim())),
        )
        .filter(Boolean)
        .slice(0, 4),
    ]),
  ).filter(Boolean);

  const groupedSkills = groupDraftSkills(draft);
  const links = [
    draft.github
      ? {
          label: "GitHub",
          value: readableLink(draft.github),
          href: draft.github,
        }
      : null,
    draft.linkedin
      ? {
          label: "LinkedIn",
          value: readableLink(draft.linkedin),
          href: draft.linkedin,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    href: string;
  }>;

  const summaryText =
    draft.notes.trim() ||
    currentExperience?.description.trim() ||
    "Perfil em construção. Registre aqui o contexto profissional que deve orientar suas próximas candidaturas.";
  const hasSummary = Boolean(
    draft.notes.trim() || currentExperience?.description.trim(),
  );

  function resetToSnapshot() {
    setDraft(createProfileReviewData(snapshot));
    onActiveSectionChange(null);
    setFeedback(null);
  }

  function saveSection() {
    if (!draft) {
      return;
    }

    const nextDraft = draft;
    setFeedback(null);

    startTransition(async () => {
      const result = await updateProfile(nextDraft);

      if (!result.ok) {
        setFeedback({
          tone: "error",
          text: result.error,
        });
        return;
      }

      setFeedback({
        tone: "success",
        text: "Alterações salvas com sucesso.",
      });
      onActiveSectionChange(null);
      router.refresh();
    });
  }

  function updateRootField<Key extends keyof ProfileReviewData>(
    key: Key,
    value: ProfileReviewData[Key],
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current,
    );
  }

  function updateCurrentRole(value: string) {
    setDraft((current) => {
      if (!current || current.experiences.length === 0) {
        return current;
      }

      return {
        ...current,
        experiences: current.experiences.map((experience, index) =>
          index === 0 ? { ...experience, role: value } : experience,
        ),
      };
    });
  }

  function updateExperience(
    experienceId: string,
    updater: (experience: ProfileReviewData["experiences"][number]) => ProfileReviewData["experiences"][number],
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            experiences: current.experiences.map((experience) =>
              experience.clientId === experienceId ? updater(experience) : experience,
            ),
          }
        : current,
    );
  }

  function updateSkill(
    skillId: string,
    updater: (skill: ProfileReviewData["skills"][number]) => ProfileReviewData["skills"][number],
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            skills: current.skills.map((skill) =>
              skill.clientId === skillId ? updater(skill) : skill,
            ),
          }
        : current,
    );
  }

  function updateEducation(
    educationId: string,
    updater: (education: ProfileReviewData["education"][number]) => ProfileReviewData["education"][number],
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            education: current.education.map((education) =>
              education.clientId === educationId ? updater(education) : education,
            ),
          }
        : current,
    );
  }

  function updateProject(
    projectId: string,
    updater: (project: ProfileReviewData["projects"][number]) => ProfileReviewData["projects"][number],
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            projects: current.projects.map((project) =>
              project.clientId === projectId ? updater(project) : project,
            ),
          }
        : current,
    );
  }

  function toggleExperienceExpansion(experienceId: string) {
    setExpandedExperiences((current) =>
      current.includes(experienceId)
        ? current.filter((id) => id !== experienceId)
        : [...current, experienceId],
    );
  }

  function sectionActions(section: EditableSection) {
    return (
      <SectionActionButtons
        activeSection={activeSection}
        isPending={isPending}
        onCancel={resetToSnapshot}
        onEdit={() => onActiveSectionChange(section)}
        onSave={saveSection}
        section={section}
      />
    );
  }

  const workModelLabel = formatWorkModel(draft.workModelPreference);

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <Panel
        aria-labelledby="profile-name"
        className="@container/panel"
        id="profile-overview"
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="min-w-0">
            <h2
              className={cn(
                "text-xl leading-tight font-semibold tracking-tight text-balance break-words sm:text-2xl",
                draft.fullName.trim() ? "text-foreground" : "text-subtle-foreground",
              )}
              id="profile-name"
            >
              {draft.fullName.trim() || "Nome não informado"}
            </h2>
            <p
              className={cn(
                "mt-1 text-sm",
                currentExperience?.role ? "text-muted-foreground" : "text-subtle-foreground",
              )}
            >
              {currentExperience?.role || "Cargo principal ainda não definido"}
            </p>
          </div>
          {sectionActions("basics")}
        </div>

        {activeSection === "basics" ? (
          <div className="mt-4 border-t border-border p-4 sm:mt-5 sm:p-5">
            <FieldGroup className="grid gap-4 @md/panel:grid-cols-2">
              <FormField id="profile-basics-full-name" label="Nome completo">
                <Input
                  id="profile-basics-full-name"
                  onChange={(event) => updateRootField("fullName", event.target.value)}
                  value={draft.fullName}
                />
              </FormField>
              <FormField
                description={
                  draft.experiences[0]
                    ? undefined
                    : "Adicione uma experiência para definir o cargo."
                }
                disabled={!draft.experiences[0]}
                id="profile-basics-role"
                label="Cargo principal"
              >
                <Input
                  disabled={!draft.experiences[0]}
                  id="profile-basics-role"
                  onChange={(event) => updateCurrentRole(event.target.value)}
                  value={draft.experiences[0]?.role ?? ""}
                />
              </FormField>
              <FormField
                className="col-span-full"
                description="Resumo exibido no topo do perfil."
                id="profile-basics-about"
                label="Sobre você"
              >
                <Textarea
                  id="profile-basics-about"
                  onChange={(event) => updateRootField("notes", event.target.value)}
                  rows={5}
                  value={draft.notes}
                />
              </FormField>
              <FormField id="profile-basics-email" label="E-mail">
                <Input
                  id="profile-basics-email"
                  onChange={(event) => updateRootField("email", event.target.value)}
                  type="email"
                  value={draft.email}
                />
              </FormField>
              <FormField id="profile-basics-phone" label="Telefone">
                <Input
                  id="profile-basics-phone"
                  onChange={(event) => updateRootField("phone", event.target.value)}
                  value={draft.phone}
                />
              </FormField>
              <FormField
                className="col-span-full"
                id="profile-basics-location"
                label="Localização"
              >
                <Input
                  id="profile-basics-location"
                  onChange={(event) => updateRootField("location", event.target.value)}
                  value={draft.location}
                />
              </FormField>
            </FieldGroup>
          </div>
        ) : (
          <>
            <dl className="flex flex-wrap gap-x-5 gap-y-1.5 px-4 pt-3 pb-4 text-[13px] sm:px-5 sm:pb-5">
              <ContactItem
                emptyText="E-mail não informado"
                icon={Mail}
                label="E-mail"
                value={draft.email}
              />
              <ContactItem
                emptyText="Telefone não informado"
                icon={Phone}
                label="Telefone"
                value={draft.phone}
              />
              <ContactItem
                emptyText="Localização não informada"
                icon={MapPin}
                label="Localização"
                value={draft.location}
              />
            </dl>

            <div className="flex flex-col gap-4 border-t border-border p-4 sm:p-5">
              <p
                className={cn(
                  "max-w-[68ch] text-sm leading-6 text-pretty",
                  hasSummary ? "text-muted-foreground" : "text-subtle-foreground",
                )}
              >
                {summaryText}
              </p>

              {heroTags.length > 0 ? (
                <ul aria-label="Destaques" className="flex flex-wrap gap-1.5">
                  {heroTags.map((tag) => (
                    <li key={tag}>
                      <Chip>{tag}</Chip>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </>
        )}
      </Panel>

      {feedback ? (
        <Notice
          bordered
          role={feedback.tone === "error" ? "alert" : "status"}
          tone={feedback.tone === "success" ? "positive" : "negative"}
        >
          {feedback.text}
        </Notice>
      ) : null}

      <div className="grid gap-4 sm:gap-5 xl:grid-cols-2">
        <SectionPanel action={sectionActions("links")} title="Links">
          {activeSection === "links" ? (
            <PanelBody>
              <FieldGroup className="grid gap-4 @xl/panel:grid-cols-2">
                <FormField id="profile-links-github" label="GitHub">
                  <Input
                    id="profile-links-github"
                    onChange={(event) => updateRootField("github", event.target.value)}
                    value={draft.github}
                  />
                </FormField>
                <FormField id="profile-links-linkedin" label="LinkedIn">
                  <Input
                    id="profile-links-linkedin"
                    onChange={(event) => updateRootField("linkedin", event.target.value)}
                    value={draft.linkedin}
                  />
                </FormField>
              </FieldGroup>
            </PanelBody>
          ) : links.length > 0 ? (
            <ul className="divide-y divide-border">
              {links.map((link) => (
                <li key={link.href}>
                  <a
                    className="group flex items-center justify-between gap-3 px-4 py-3 outline-none transition-colors duration-150 hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset sm:px-5"
                    href={link.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">{link.label}</p>
                      <p className="truncate text-[13px] text-subtle-foreground">
                        {link.value}
                      </p>
                    </div>
                    <span
                      aria-hidden
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon-sm" }),
                        "-mr-1.5 group-hover:bg-accent group-hover:text-foreground",
                      )}
                    >
                      <ExternalLink />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <SectionEmpty>Adicione GitHub ou LinkedIn para preencher esta seção.</SectionEmpty>
          )}
        </SectionPanel>

        <SectionPanel action={sectionActions("preferences")} title="Preferências">
          <PanelBody>
            {activeSection === "preferences" ? (
              <FieldGroup className="grid gap-4 @xl/panel:grid-cols-2">
                <FormField id="profile-preferences-work-model" label="Modelo de trabalho">
                  <Select
                    items={WORK_MODEL_OPTIONS}
                    onValueChange={(value) =>
                      updateRootField("workModelPreference", value ?? "")
                    }
                    value={draft.workModelPreference || undefined}
                  >
                    <SelectTrigger className="w-full" id="profile-preferences-work-model">
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
                </FormField>
                <FormField id="profile-preferences-company-type" label="Tipo de empresa">
                  <Input
                    id="profile-preferences-company-type"
                    onChange={(event) =>
                      updateRootField("companyTypePreference", event.target.value)
                    }
                    value={draft.companyTypePreference}
                  />
                </FormField>
                <FormField
                  className="col-span-full"
                  id="profile-preferences-values"
                  label="Valores"
                >
                  <Textarea
                    id="profile-preferences-values"
                    onChange={(event) =>
                      updateRootField("valuesPreference", event.target.value)
                    }
                    rows={4}
                    value={draft.valuesPreference}
                  />
                </FormField>
              </FieldGroup>
            ) : (
              <dl className="grid gap-x-6 gap-y-4 @md/panel:grid-cols-2">
                <DefinitionItem label="Modelo de trabalho" value={workModelLabel} />
                <DefinitionItem
                  label="Tipo de empresa"
                  value={draft.companyTypePreference}
                />
                <DefinitionItem
                  className="col-span-full"
                  label="Valores"
                  value={draft.valuesPreference}
                />
              </dl>
            )}
          </PanelBody>
        </SectionPanel>
      </div>

      <SectionPanel action={sectionActions("experiences")} title="Experiências">
        {activeSection === "experiences" ? (
          <>
            <ol className="divide-y divide-border">
              {draft.experiences.map((experience, index) => (
                <li className="flex flex-col gap-4 px-4 py-5 sm:px-5" key={experience.clientId}>
                  <EditorItemHeader
                    onRemove={() =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              experiences:
                                current.experiences.length > 1
                                  ? current.experiences.filter(
                                      (item) => item.clientId !== experience.clientId,
                                    )
                                  : [createEmptyExperience()],
                            }
                          : current,
                      )
                    }
                    removeLabel={`Remover experiência ${index + 1}`}
                    title={`Experiência ${index + 1}`}
                  />

                  <FieldGroup className="grid gap-4 @md/panel:grid-cols-2 @2xl/panel:grid-cols-6">
                    <FormField
                      className="@2xl/panel:col-span-3"
                      id={`${experience.clientId}-company`}
                      label="Empresa"
                    >
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
                    </FormField>
                    <FormField
                      className="@2xl/panel:col-span-3"
                      id={`${experience.clientId}-role`}
                      label="Cargo"
                    >
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
                    </FormField>
                    <FormField
                      className="@2xl/panel:col-span-2"
                      id={`${experience.clientId}-start`}
                      label="Início"
                    >
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
                    </FormField>
                    <FormField
                      className="@2xl/panel:col-span-2"
                      disabled={experience.isCurrent}
                      id={`${experience.clientId}-end`}
                      label="Fim"
                    >
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
                    </FormField>
                    <FormField
                      className="@md/panel:col-span-2"
                      id={`${experience.clientId}-status`}
                      label="Status"
                    >
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
                    </FormField>
                    <FormField
                      className="col-span-full"
                      id={`${experience.clientId}-description`}
                      label="Descrição"
                    >
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
                    </FormField>
                  </FieldGroup>

                  {/* Hairline on a wrapper: on the fieldset itself the legend
                      would be drawn over the border. */}
                  <div className="border-t border-border pt-4">
                    <FieldSet className="gap-4">
                      <FieldLegend className="mb-0" variant="label">
                        Bullet points
                      </FieldLegend>
                      <FieldDescription>
                        Expanda os detalhes da experiência com resultados e tags.
                      </FieldDescription>
  
                      <ol className="flex flex-col gap-5">
                        {experience.bullets.map((bullet, bulletIndex) => (
                          <li className="flex flex-col gap-3" key={bullet.clientId}>
                            <div className="flex items-center justify-between gap-3">
                              <h4 className="text-[13px] font-medium text-muted-foreground">
                                Bullet {bulletIndex + 1}
                              </h4>
                              <RemoveButton
                                className="-mr-1.5"
                                label={`Remover bullet ${bulletIndex + 1}`}
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
                            <div className="grid gap-3 @2xl/panel:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
                              <FormField id={`${bullet.clientId}-content`} label="Conteúdo">
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
                              </FormField>
                              <FormField id={`${bullet.clientId}-tags`} label="Tags">
                                <Input
                                  id={`${bullet.clientId}-tags`}
                                  onChange={(event) =>
                                    updateExperience(experience.clientId, (current) => ({
                                      ...current,
                                      bullets: current.bullets.map((item) =>
                                        item.clientId === bullet.clientId
                                          ? {
                                              ...item,
                                              tags: splitTags(event.target.value),
                                            }
                                          : item,
                                      ),
                                    }))
                                  }
                                  placeholder="Ex.: React, Node.js, liderança"
                                  value={bullet.tags.join(", ")}
                                />
                              </FormField>
                            </div>
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

            <AddItemRow
              onClick={() =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        experiences: [...current.experiences, createEmptyExperience()],
                      }
                    : current,
                )
              }
            >
              Adicionar experiência
            </AddItemRow>
          </>
        ) : draft.experiences.length > 0 ? (
          <ol className="divide-y divide-border">
            {draft.experiences.map((experience) => {
              const isExpanded = expandedExperiences.includes(experience.clientId);
              const tags = Array.from(
                new Set(
                  experience.bullets.flatMap((bullet) =>
                    bullet.tags.map((tag) => tag.trim()).filter(Boolean),
                  ),
                ),
              ).slice(0, 4);
              // Blank bullets (the editor keeps one placeholder) have nothing to show.
              const bullets = experience.bullets.filter((bullet) => bullet.content.trim());

              return (
                <li className="px-4 py-4 sm:px-5" key={experience.clientId}>
                  <div className="flex flex-col gap-1 @md/panel:flex-row @md/panel:items-baseline @md/panel:justify-between @md/panel:gap-6">
                    <div className="min-w-0">
                      <h3 className="text-[15px] leading-snug font-medium text-balance text-foreground">
                        {experience.role}
                      </h3>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {experience.company}
                      </p>
                    </div>
                    <p className="shrink-0 font-data text-xs text-subtle-foreground">
                      {formatPeriod(experience.startDate, experience.endDate || null)}
                    </p>
                  </div>

                  {experience.description ? (
                    <p className="mt-2 max-w-[68ch] text-sm leading-6 text-pretty text-muted-foreground">
                      {experience.description}
                    </p>
                  ) : null}

                  {tags.length > 0 || bullets.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <MetaLine items={tags} />
                      {bullets.length > 0 ? (
                        <Button
                          aria-expanded={isExpanded}
                          className="-mr-2.5 ml-auto"
                          onClick={() => toggleExperienceExpansion(experience.clientId)}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          {isExpanded ? (
                            <ChevronUp data-icon="inline-start" />
                          ) : (
                            <ChevronDown data-icon="inline-start" />
                          )}
                          {isExpanded ? "Ocultar bullets" : "Ver bullets"}
                          <span className="font-data text-xs text-subtle-foreground">
                            {bullets.length}
                          </span>
                        </Button>
                      ) : null}
                    </div>
                  ) : null}

                  {isExpanded && bullets.length > 0 ? (
                    <ul className="mt-3 flex max-w-[68ch] flex-col gap-2">
                      {bullets.map((bullet) => (
                        <li
                          className="flex gap-3 text-sm leading-6 text-pretty text-muted-foreground"
                          key={bullet.clientId}
                        >
                          <span
                            aria-hidden
                            className="mt-2.5 size-1 shrink-0 rounded-full bg-subtle-foreground"
                          />
                          <span className="min-w-0">{bullet.content}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : (
          <SectionEmpty>Nenhuma experiência registrada ainda.</SectionEmpty>
        )}
      </SectionPanel>

      <SectionPanel action={sectionActions("projects")} title="Projetos">
        {activeSection === "projects" ? (
          <>
            <ol className="divide-y divide-border">
              {draft.projects.map((project, index) => (
                <li className="flex flex-col gap-4 px-4 py-5 sm:px-5" key={project.clientId}>
                  <EditorItemHeader
                    onRemove={() =>
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              projects:
                                current.projects.length > 1
                                  ? current.projects.filter(
                                      (item) => item.clientId !== project.clientId,
                                    )
                                  : [createEmptyProject()],
                            }
                          : current,
                      )
                    }
                    removeLabel={`Remover projeto ${index + 1}`}
                    title={`Projeto ${index + 1}`}
                  />

                  <FieldGroup className="grid gap-4 @md/panel:grid-cols-2">
                    <FormField id={`${project.clientId}-name`} label="Nome">
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
                    </FormField>
                    <FormField id={`${project.clientId}-url`} label="URL (repositório ou demo)">
                      <Input
                        id={`${project.clientId}-url`}
                        onChange={(event) =>
                          updateProject(project.clientId, (current) => ({
                            ...current,
                            url: event.target.value,
                          }))
                        }
                        placeholder="https://github.com/..."
                        value={project.url}
                      />
                    </FormField>
                    <FormField
                      className="col-span-full"
                      id={`${project.clientId}-stack`}
                      label="Stack (separada por vírgulas)"
                    >
                      <Input
                        id={`${project.clientId}-stack`}
                        onChange={(event) =>
                          updateProject(project.clientId, (current) => ({
                            ...current,
                            stack: event.target.value,
                          }))
                        }
                        placeholder="Ex.: TypeScript, React, Node.js"
                        value={project.stack}
                      />
                    </FormField>
                    <FormField
                      className="col-span-full"
                      id={`${project.clientId}-description`}
                      label="Descrição"
                    >
                      <Textarea
                        id={`${project.clientId}-description`}
                        onChange={(event) =>
                          updateProject(project.clientId, (current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        rows={2}
                        value={project.description}
                      />
                    </FormField>
                    <FormField
                      className="col-span-full"
                      id={`${project.clientId}-impact`}
                      label="Impacto e destaques"
                    >
                      <Textarea
                        id={`${project.clientId}-impact`}
                        onChange={(event) =>
                          updateProject(project.clientId, (current) => ({
                            ...current,
                            impact: event.target.value,
                          }))
                        }
                        rows={2}
                        value={project.impact}
                      />
                    </FormField>
                  </FieldGroup>
                </li>
              ))}
            </ol>

            <AddItemRow
              onClick={() =>
                setDraft((current) =>
                  current
                    ? {
                        ...current,
                        projects: [...current.projects, createEmptyProject()],
                      }
                    : current,
                )
              }
            >
              Adicionar projeto
            </AddItemRow>
          </>
        ) : draft.projects.length > 0 ? (
          <ul className="divide-y divide-border">
            {draft.projects.map((project) => {
              const stackTags = project.stack
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 5);

              return (
                <li className="flex items-start gap-3 px-4 py-4 sm:px-5" key={project.clientId}>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-[15px] leading-snug font-medium text-balance text-foreground">
                      {project.name}
                    </h3>
                    {stackTags.length > 0 ? (
                      <MetaLine className="mt-0.5" items={stackTags} />
                    ) : null}
                    {project.description ? (
                      <p className="mt-2 max-w-[68ch] text-sm leading-6 text-pretty text-muted-foreground">
                        {project.description}
                      </p>
                    ) : null}
                    {project.impact ? (
                      <p className="mt-1.5 max-w-[68ch] text-[13px] leading-5 text-pretty text-subtle-foreground">
                        {project.impact}
                      </p>
                    ) : null}
                  </div>
                  {project.url ? (
                    <a
                      aria-label={`Abrir ${project.name || "projeto"}`}
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon-sm" }),
                        "-mt-0.5 -mr-1.5",
                      )}
                      href={project.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink />
                    </a>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <SectionEmpty>Nenhum projeto cadastrado ainda.</SectionEmpty>
        )}
      </SectionPanel>

      <div className="grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <SectionPanel action={sectionActions("skills")} title="Habilidades">
          {activeSection === "skills" ? (
            <>
              <ul className="divide-y divide-border">
                {draft.skills.map((skill, index) => (
                  <li className="flex items-end gap-2 px-4 py-4 sm:px-5" key={skill.clientId}>
                    <div className="grid min-w-0 flex-1 gap-3 @md/panel:grid-cols-2 @2xl/panel:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_5.5rem]">
                      <FormField id={`${skill.clientId}-name`} label="Nome">
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
                      </FormField>
                      <FormField id={`${skill.clientId}-level`} label="Nível">
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
                      </FormField>
                      <FormField id={`${skill.clientId}-category`} label="Categoria">
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
                      </FormField>
                      <FormField id={`${skill.clientId}-years`} label="Anos">
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
                      </FormField>
                    </div>
                    <RemoveButton
                      label={`Remover habilidade ${index + 1}`}
                      onClick={() =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                skills:
                                  current.skills.length > 1
                                    ? current.skills.filter(
                                        (item) => item.clientId !== skill.clientId,
                                      )
                                    : [createEmptySkill()],
                              }
                            : current,
                        )
                      }
                      size="icon"
                    />
                  </li>
                ))}
              </ul>

              <AddItemRow
                onClick={() =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          skills: [...current.skills, createEmptySkill()],
                        }
                      : current,
                  )
                }
              >
                Adicionar habilidade
              </AddItemRow>
            </>
          ) : groupedSkills.length > 0 ? (
            <PanelBody>
              <dl className="flex flex-col gap-4">
                {groupedSkills.map((group) => (
                  <div
                    className="grid gap-2 @md/panel:grid-cols-[7.5rem_minmax(0,1fr)] @md/panel:gap-4"
                    key={group.label}
                  >
                    <dt className="text-xs text-subtle-foreground @md/panel:pt-0.5">
                      {group.label}
                    </dt>
                    <dd className="flex flex-wrap gap-1.5">
                      {group.skills.map((skill) => (
                        <Chip key={skill.clientId}>{skill.name}</Chip>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </PanelBody>
          ) : (
            <SectionEmpty>Nenhuma habilidade extraída ainda.</SectionEmpty>
          )}
        </SectionPanel>

        <SectionPanel action={sectionActions("education")} title="Formação acadêmica">
          {activeSection === "education" ? (
            <>
              <ol className="divide-y divide-border">
                {draft.education.map((education, index) => (
                  <li className="flex flex-col gap-4 px-4 py-5 sm:px-5" key={education.clientId}>
                    <EditorItemHeader
                      onRemove={() =>
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                education:
                                  current.education.length > 1
                                    ? current.education.filter(
                                        (item) => item.clientId !== education.clientId,
                                      )
                                    : [createEmptyEducation()],
                              }
                            : current,
                        )
                      }
                      removeLabel={`Remover formação ${index + 1}`}
                      title={`Formação ${index + 1}`}
                    />

                    <FieldGroup className="grid gap-4 @md/panel:grid-cols-2">
                      <FormField id={`${education.clientId}-institution`} label="Instituição">
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
                      </FormField>
                      <FormField id={`${education.clientId}-degree`} label="Curso ou grau">
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
                      </FormField>
                      <FormField
                        className="col-span-full"
                        id={`${education.clientId}-field`}
                        label="Área"
                      >
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
                      </FormField>
                      <FormField id={`${education.clientId}-start`} label="Início">
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
                      </FormField>
                      <FormField id={`${education.clientId}-end`} label="Fim">
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
                      </FormField>
                    </FieldGroup>
                  </li>
                ))}
              </ol>

              <AddItemRow
                onClick={() =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          education: [...current.education, createEmptyEducation()],
                        }
                      : current,
                  )
                }
              >
                Adicionar formação
              </AddItemRow>
            </>
          ) : draft.education.length > 0 ? (
            <ol className="divide-y divide-border">
              {draft.education.map((education) => {
                const hasPeriod = Boolean(education.startDate || education.endDate);

                return (
                  <li
                    className="flex flex-col gap-1 px-4 py-4 sm:px-5 @md/panel:flex-row @md/panel:items-baseline @md/panel:justify-between @md/panel:gap-6"
                    key={education.clientId}
                  >
                    <div className="min-w-0">
                      <h3 className="text-[15px] leading-snug font-medium text-balance text-foreground">
                        {[education.degree, education.field].filter(Boolean).join(" em ") ||
                          "Formação registrada"}
                      </h3>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {education.institution}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "shrink-0 text-xs text-subtle-foreground",
                        hasPeriod && "font-data",
                      )}
                    >
                      {formatEducationPeriod(education.startDate, education.endDate)}
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <SectionEmpty>Nenhuma formação cadastrada ainda.</SectionEmpty>
          )}
        </SectionPanel>
      </div>

      {/* Phones: while a section is in edit mode, save/cancel stay under the
          thumb and replace the tab bar instead of living at the section top. */}
      {activeSection ? (
        <div className="fixed inset-x-0 bottom-0 z-(--z-action-bar) animate-in border-t border-border bg-canvas px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] duration-200 fade-in-0 slide-in-from-bottom-3 md:hidden">
          <p className="mb-2 text-xs text-subtle-foreground">
            Editando {sectionLabels[activeSection]}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              disabled={isPending}
              onClick={resetToSnapshot}
              type="button"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button disabled={isPending} onClick={saveSection} type="button">
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SectionPanel({
  action,
  children,
  title,
}: {
  action: React.ReactNode;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Panel className="@container/panel overflow-hidden">
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
        {action}
      </PanelHeader>
      {children}
    </Panel>
  );
}

function SectionActionButtons({
  activeSection,
  isPending,
  onCancel,
  onEdit,
  onSave,
  section,
}: {
  activeSection: EditableSection | null;
  isPending: boolean;
  onCancel: () => void;
  onEdit: () => void;
  onSave: () => void;
  section: EditableSection;
}) {
  const isActive = activeSection === section;
  const isDisabled = activeSection !== null && activeSection !== section;

  if (isActive) {
    // Phones save and cancel from the pinned edit bar instead.
    return (
      <div className="hidden shrink-0 items-center gap-1.5 md:flex">
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          Cancelar
        </Button>
        <Button disabled={isPending} onClick={onSave} size="sm" type="button">
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    );
  }

  return (
    <Button
      aria-label={`Editar ${sectionLabels[section]}`}
      className="-mr-1.5 shrink-0"
      disabled={isDisabled}
      onClick={onEdit}
      size="sm"
      type="button"
      variant="ghost"
    >
      Editar
    </Button>
  );
}

function EditorItemHeader({
  onRemove,
  removeLabel,
  title,
}: {
  onRemove: () => void;
  removeLabel: string;
  title: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <RemoveButton className="-mr-1.5" label={removeLabel} onClick={onRemove} />
    </div>
  );
}

function RemoveButton({
  className,
  label,
  onClick,
  size = "icon-sm",
}: {
  className?: string;
  label: string;
  onClick: () => void;
  size?: "icon-sm" | "icon";
}) {
  return (
    <Button
      aria-label={label}
      className={cn("shrink-0 hover:bg-negative/10 hover:text-negative", className)}
      onClick={onClick}
      size={size}
      type="button"
      variant="ghost"
    >
      <Trash2 />
    </Button>
  );
}

function AddItemRow({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div className="border-t border-border px-4 py-3 sm:px-5">
      <Button onClick={onClick} size="sm" type="button" variant="outline">
        <Plus data-icon="inline-start" />
        {children}
      </Button>
    </div>
  );
}

function ContactItem({
  emptyText,
  icon: Icon,
  label,
  value,
}: {
  emptyText: string;
  icon: React.ComponentType<React.ComponentProps<"svg">>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <dt className="shrink-0">
        <Icon aria-hidden className="size-3.5 text-subtle-foreground" />
        <span className="sr-only">{label}</span>
      </dt>
      <dd
        className={cn(
          "min-w-0 wrap-anywhere",
          value ? "text-muted-foreground" : "text-subtle-foreground",
        )}
      >
        {value || emptyText}
      </dd>
    </div>
  );
}

function DefinitionItem({
  className,
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string | null;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs text-subtle-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 max-w-[68ch] text-sm break-words text-pretty",
          value ? "text-foreground" : "text-subtle-foreground",
        )}
      >
        {value || "Não definido"}
      </dd>
    </div>
  );
}

function FormField({
  children,
  className,
  description,
  disabled = false,
  id,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  description?: string;
  disabled?: boolean;
  id: string;
  label: string;
}) {
  return (
    <Field className={className} data-disabled={disabled || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
}

function SectionEmpty({ children }: { children: React.ReactNode }) {
  return (
    <PanelBody>
      <p className="text-[13px] text-subtle-foreground">{children}</p>
    </PanelBody>
  );
}

function groupDraftSkills(draft: ProfileReviewData) {
  const groups = new Map<string, ProfileReviewData["skills"]>();

  for (const skill of draft.skills) {
    if (!skill.name.trim()) {
      continue;
    }

    const label = formatSkillCategory(skill.category || null);
    const currentGroup = groups.get(label) ?? [];
    currentGroup.push(skill);
    groups.set(label, currentGroup);
  }

  return Array.from(groups.entries()).map(([label, skills]) => ({
    label,
    skills,
  }));
}

function formatWorkModel(value: ProfileReviewData["workModelPreference"]) {
  return WORK_MODEL_OPTIONS.find((option) => option.value === value)?.label ?? null;
}

function formatSkillCategory(category: string | null) {
  switch (category) {
    case "language":
      return "Linguagens";
    case "framework":
      return "Frameworks";
    case "tool":
      return "Ferramentas";
    case "soft-skill":
      return "Soft skills";
    default:
      return "Outras";
  }
}

function formatPeriod(startDate: string, endDate: string | null) {
  return [formatMonthYear(startDate), endDate ? formatMonthYear(endDate) : "Atual"]
    .filter(Boolean)
    .join(" – ");
}

function formatEducationPeriod(startDate: string, endDate: string) {
  if (!startDate && !endDate) {
    return "Período não informado";
  }

  return `${startDate ? formatMonthYear(startDate) : "Início não informado"} – ${endDate ? formatMonthYear(endDate) : "Em andamento"}`;
}

/** "2022-03" -> "mar 2022" (compact, reads well in the data face). */
function formatMonthYear(value: string) {
  const [year, month] = value.split("-");

  if (!year || !month) {
    return value;
  }

  const parts = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).formatToParts(new Date(Number(year), Number(month) - 1, 1));
  const monthLabel = parts
    .find((part) => part.type === "month")
    ?.value.replace(/\.$/, "");
  const yearLabel = parts.find((part) => part.type === "year")?.value;

  return monthLabel && yearLabel ? `${monthLabel} ${yearLabel}` : value;
}

function readableLink(value: string) {
  return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function splitTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
