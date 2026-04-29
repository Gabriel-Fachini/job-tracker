"use client";

import type React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Cormorant_Garamond } from "next/font/google";
import {
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  Globe,
  GraduationCap,
  Link as LinkIcon,
  LoaderCircle,
  Mail,
  MapPin,
  PenLine,
  Phone,
  Plus,
  Save,
  Trash2,
  Workflow,
  Wrench,
  X,
} from "lucide-react";

import {
  createEmptyBullet,
  createEmptyEducation,
  createEmptyExperience,
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
import { Button } from "@/components/ui/button";
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

type EditableSection =
  | "basics"
  | "links"
  | "preferences"
  | "experiences"
  | "skills"
  | "education";

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

  function toggleExperienceExpansion(experienceId: string) {
    setExpandedExperiences((current) =>
      current.includes(experienceId)
        ? current.filter((id) => id !== experienceId)
        : [...current, experienceId],
    );
  }

  return (
    <div className={`${profileDisplay.variable} flex flex-col gap-4 md:gap-5`}>
      <section
        id="profile-overview"
        className="relative overflow-hidden rounded-[1.9rem] border border-emerald-400/16 bg-[linear-gradient(180deg,rgba(23,31,26,0.98),rgba(17,24,20,0.98))] shadow-[0_28px_80px_rgba(0,0,0,0.34)]"
      >
        <div className="absolute top-6 right-6 z-10">
          <SectionActionButtons
            activeSection={activeSection}
            isPending={isPending}
            onCancel={resetToSnapshot}
            onEdit={() => onActiveSectionChange("basics")}
            onSave={saveSection}
            section="basics"
          />
        </div>
        <div className="grid gap-8 px-6 py-6 md:px-7 md:py-7 xl:grid-cols-[minmax(0,1.55fr)_290px]">
          <div className="flex min-w-0 flex-col gap-6">
            <div className="flex items-start gap-4 pr-28">
              <div className="flex flex-1 flex-col gap-5 md:flex-row md:items-start">
                <div className="relative flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-100/80 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.32),transparent_24%),linear-gradient(160deg,rgba(63,125,90,0.95),rgba(27,61,43,0.98))] text-4xl font-semibold text-white shadow-[0_20px_44px_rgba(0,0,0,0.42)]">
                  <div className="absolute inset-[16%] rounded-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.32),transparent_28%),linear-gradient(180deg,rgba(32,33,37,0.12),rgba(17,17,17,0.55))]" />
                  <span className="relative z-10">{getInitials(draft.fullName)}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="text-[2.6rem] leading-none font-[family:var(--font-profile-display)] text-stone-50 md:text-[3.1rem]">
                    {draft.fullName}
                  </h2>
                  <p className="mt-2 text-[1.08rem] text-emerald-300/90">
                    {currentExperience?.role || "Cargo principal ainda não definido"}
                  </p>
                  <p className="mt-3 max-w-3xl text-[0.97rem] leading-8 text-stone-300/78">
                    {summaryText}
                  </p>
                </div>
              </div>
            </div>

            {heroTags.length > 0 ? (
              <div className="flex flex-wrap gap-2.5">
                {heroTags.map((tag) => (
                  <span
                    className="rounded-full border border-emerald-400/12 bg-emerald-500/8 px-3 py-1.5 text-[0.79rem] text-emerald-100/90"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {activeSection === "basics" ? (
              <div className="grid gap-4 rounded-[1.4rem] border border-emerald-400/14 bg-black/10 p-4 md:grid-cols-2">
                <FormField label="Nome completo">
                  <Input
                    onChange={(event) => updateRootField("fullName", event.target.value)}
                    value={draft.fullName}
                  />
                </FormField>
                <FormField label="Cargo principal">
                  <Input
                    disabled={!draft.experiences[0]}
                    onChange={(event) => updateCurrentRole(event.target.value)}
                    value={draft.experiences[0]?.role ?? ""}
                  />
                </FormField>
                <FormField className="md:col-span-2" label="Sobre você">
                  <Textarea
                    onChange={(event) => updateRootField("notes", event.target.value)}
                    rows={5}
                    value={draft.notes}
                  />
                </FormField>
                <FormField label="E-mail">
                  <Input
                    onChange={(event) => updateRootField("email", event.target.value)}
                    type="email"
                    value={draft.email}
                  />
                </FormField>
                <FormField label="Telefone">
                  <Input
                    onChange={(event) => updateRootField("phone", event.target.value)}
                    value={draft.phone}
                  />
                </FormField>
                <FormField className="md:col-span-2" label="Localização">
                  <Input
                    onChange={(event) => updateRootField("location", event.target.value)}
                    value={draft.location}
                  />
                </FormField>
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-[1.5rem] border border-white/8 bg-black/10 p-4">
            <ContactLine icon={Mail} text={draft.email || "E-mail não informado"} />
            <ContactLine icon={Phone} text={draft.phone || "Telefone não informado"} />
            <ContactLine
              icon={MapPin}
              text={draft.location || "Localização não informada"}
            />
          </div>
        </div>
      </section>

      {feedback ? (
        <div
          className={cn(
            "rounded-[1.2rem] border px-4 py-3 text-sm",
            feedback.tone === "success"
              ? "border-emerald-400/18 bg-emerald-500/8 text-emerald-100"
              : "border-red-400/20 bg-red-500/10 text-red-200",
          )}
        >
          {feedback.text}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <PanelCard
          action={
            <SectionActionButtons
              activeSection={activeSection}
              isPending={isPending}
              onCancel={resetToSnapshot}
              onEdit={() => onActiveSectionChange("links")}
              onSave={saveSection}
              section="links"
            />
          }
          icon={LinkIcon}
          title="Links"
        >
          {activeSection === "links" ? (
            <div className="grid gap-4">
              <FormField label="GitHub">
                <Input
                  onChange={(event) => updateRootField("github", event.target.value)}
                  value={draft.github}
                />
              </FormField>
              <FormField label="LinkedIn">
                <Input
                  onChange={(event) => updateRootField("linkedin", event.target.value)}
                  value={draft.linkedin}
                />
              </FormField>
            </div>
          ) : links.length > 0 ? (
            <div className="flex flex-col gap-3.5">
              {links.map((link) => (
                <a
                  className="group flex items-center justify-between gap-3 rounded-[1.1rem] border border-white/6 bg-white/[0.03] px-3 py-3 transition-colors hover:border-emerald-400/20 hover:bg-white/[0.045]"
                  href={link.href}
                  key={link.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-100">
                      <Globe className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm text-stone-100">{link.label}</p>
                      <p className="truncate text-sm text-stone-400">{link.value}</p>
                    </div>
                  </div>
                  <span className="text-stone-500 transition-colors group-hover:text-emerald-300">
                    <LinkIcon className="size-4" />
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <EmptyBlock text="Adicione GitHub ou LinkedIn para preencher esta seção." />
          )}
        </PanelCard>

        <PanelCard
          action={
            <SectionActionButtons
              activeSection={activeSection}
              isPending={isPending}
              onCancel={resetToSnapshot}
              onEdit={() => onActiveSectionChange("preferences")}
              onSave={saveSection}
              section="preferences"
            />
          }
          icon={Workflow}
          title="Preferências"
        >
          {activeSection === "preferences" ? (
            <div className="grid gap-4">
              <FormField label="Modelo de trabalho">
                <Select
                  items={WORK_MODEL_OPTIONS}
                  onValueChange={(value) =>
                    updateRootField("workModelPreference", value ?? "")
                  }
                  value={draft.workModelPreference || undefined}
                >
                  <SelectTrigger className="w-full">
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
              <FormField label="Tipo de empresa">
                <Input
                  onChange={(event) =>
                    updateRootField("companyTypePreference", event.target.value)
                  }
                  value={draft.companyTypePreference}
                />
              </FormField>
              <FormField label="Valores">
                <Textarea
                  onChange={(event) =>
                    updateRootField("valuesPreference", event.target.value)
                  }
                  rows={4}
                  value={draft.valuesPreference}
                />
              </FormField>
            </div>
          ) : (
            <div className="space-y-3">
              <ReadRow
                label="Modelo de trabalho"
                value={formatWorkModel(draft.workModelPreference)}
              />
              <ReadRow
                label="Tipo de empresa"
                value={draft.companyTypePreference || "Não definido"}
              />
              <ReadRow label="Valores" value={draft.valuesPreference || "Não definido"} />
            </div>
          )}
        </PanelCard>
      </section>

      <PanelCard
        action={
          <SectionActionButtons
            activeSection={activeSection}
            isPending={isPending}
            onCancel={resetToSnapshot}
            onEdit={() => onActiveSectionChange("experiences")}
            onSave={saveSection}
            section="experiences"
          />
        }
        icon={BriefcaseBusiness}
        title="Experiências"
      >
        {activeSection === "experiences" ? (
          <div className="space-y-4">
            {draft.experiences.map((experience, index) => (
              <div
                className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] p-4"
                key={experience.clientId}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-stone-100">
                      Experiência {index + 1}
                    </p>
                    <p className="text-sm text-stone-400">
                      Cargo, empresa e detalhes principais.
                    </p>
                  </div>
                  <Button
                    className="border-white/10 text-stone-200 hover:bg-white/[0.04]"
                    onClick={() =>
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
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField label="Empresa">
                    <Input
                      onChange={(event) =>
                        updateExperience(experience.clientId, (current) => ({
                          ...current,
                          company: event.target.value,
                        }))
                      }
                      value={experience.company}
                    />
                  </FormField>
                  <FormField label="Cargo">
                    <Input
                      onChange={(event) =>
                        updateExperience(experience.clientId, (current) => ({
                          ...current,
                          role: event.target.value,
                        }))
                      }
                      value={experience.role}
                    />
                  </FormField>
                  <FormField label="Início">
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
                  </FormField>
                  <FormField label="Fim">
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
                  </FormField>
                  <FormField label="Status">
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
                  </FormField>
                  <FormField className="md:col-span-2" label="Descrição">
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
                  </FormField>
                </div>

                <div className="mt-4 rounded-[1.1rem] border border-white/8 bg-black/10 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-stone-100">Bullet points</p>
                      <p className="text-sm text-stone-400">
                        Expanda os detalhes da experiência com resultados e tags.
                      </p>
                    </div>
                    <Button
                      className="border-emerald-400/18 bg-emerald-500/8 text-emerald-100 hover:bg-emerald-500/14"
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
                      <Plus className="size-4" />
                      Adicionar bullet
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {experience.bullets.map((bullet, bulletIndex) => (
                      <div
                        className="rounded-[1rem] border border-white/8 bg-white/[0.02] p-3"
                        key={bullet.clientId}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm text-stone-200">Bullet {bulletIndex + 1}</p>
                          <Button
                            className="border-white/10 text-stone-200 hover:bg-white/[0.04]"
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
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                        <div className="grid gap-3">
                          <FormField label="Conteúdo">
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
                          </FormField>
                          <FormField label="Tags">
                            <Input
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
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <Button
              className="h-11 rounded-[1rem] border-emerald-400/18 bg-emerald-500/8 text-emerald-100 hover:bg-emerald-500/14"
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
              type="button"
              variant="outline"
            >
              <Plus className="size-4" />
              Adicionar experiência
            </Button>
          </div>
        ) : draft.experiences.length > 0 ? (
          <div className="space-y-6">
            {draft.experiences.map((experience) => {
              const isExpanded = expandedExperiences.includes(experience.clientId);
              const tags = Array.from(
                new Set(
                  experience.bullets.flatMap((bullet) =>
                    bullet.tags.map((tag) => tag.trim()).filter(Boolean),
                  ),
                ),
              ).slice(0, 4);

              return (
                <article
                  className="relative pl-10 before:absolute before:left-[0.6rem] before:top-1 before:h-[calc(100%+1.7rem)] before:w-px before:bg-white/10 last:before:hidden"
                  key={experience.clientId}
                >
                  <span className="absolute left-0 top-1.5 size-4 rounded-full border border-emerald-200/14 bg-emerald-400/60 shadow-[0_0_0_6px_rgba(255,255,255,0.015)]" />
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <h4 className="font-[family:var(--font-profile-display)] text-[1.7rem] leading-none text-stone-100">
                        {experience.role}
                      </h4>
                      <p className="mt-2 text-[1.02rem] text-emerald-300/88">
                        {experience.company}
                      </p>
                      <p className="mt-1 text-sm text-stone-400">
                        {formatPeriod(experience.startDate, experience.endDate || null)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                      {tags.map((tag) => (
                        <span
                          className="rounded-[0.8rem] border border-emerald-400/12 px-3 py-1.5 text-[0.79rem] text-stone-300/85"
                          key={tag}
                        >
                          {tag}
                        </span>
                      ))}
                      {experience.bullets.length > 0 ? (
                        <Button
                          className="h-9 rounded-[0.85rem] border-emerald-400/18 bg-emerald-500/8 text-emerald-100 hover:bg-emerald-500/14"
                          onClick={() => toggleExperienceExpansion(experience.clientId)}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {isExpanded ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                          {isExpanded ? "Ocultar bullets" : "Ver bullets"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  {experience.description ? (
                    <p className="mt-3 text-sm leading-7 text-stone-300/74">
                      {experience.description}
                    </p>
                  ) : null}

                  {isExpanded && experience.bullets.length > 0 ? (
                    <ul className="mt-4 space-y-2">
                      {experience.bullets.map((bullet) => (
                        <li
                          className="rounded-[1rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-7 text-stone-200/90"
                          key={bullet.clientId}
                        >
                          {bullet.content}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyBlock text="Nenhuma experiência registrada ainda." />
        )}
      </PanelCard>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <PanelCard
          action={
            <SectionActionButtons
              activeSection={activeSection}
              isPending={isPending}
              onCancel={resetToSnapshot}
              onEdit={() => onActiveSectionChange("skills")}
              onSave={saveSection}
              section="skills"
            />
          }
          icon={Wrench}
          title="Habilidades"
        >
          {activeSection === "skills" ? (
            <div className="space-y-3">
              {draft.skills.map((skill, index) => (
                <div
                  className="grid gap-3 rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_120px_auto]"
                  key={skill.clientId}
                >
                  <FormField label="Nome">
                    <Input
                      onChange={(event) =>
                        updateSkill(skill.clientId, (current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      value={skill.name}
                    />
                  </FormField>
                  <FormField label="Nível">
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
                  </FormField>
                  <FormField label="Categoria">
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
                  </FormField>
                  <FormField label="Anos">
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
                  </FormField>
                  <div className="flex items-end justify-end">
                    <Button
                      aria-label={`Remover habilidade ${index + 1}`}
                      className="border-white/10 text-stone-200 hover:bg-white/[0.04]"
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
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button
                className="h-11 rounded-[1rem] border-emerald-400/18 bg-emerald-500/8 text-emerald-100 hover:bg-emerald-500/14"
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
                type="button"
                variant="outline"
              >
                <Plus className="size-4" />
                Adicionar habilidade
              </Button>
            </div>
          ) : groupedSkills.length > 0 ? (
            <div className="space-y-4">
              {groupedSkills.map((group) => (
                <div
                  className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)] md:items-start"
                  key={group.label}
                >
                  <p className="pt-1 text-sm text-stone-400">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.skills.map((skill) => (
                      <span
                        className="rounded-[0.8rem] border border-emerald-400/12 bg-emerald-500/6 px-3 py-1.5 text-[0.83rem] text-stone-200/88"
                        key={skill.clientId}
                      >
                        {skill.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyBlock text="Nenhuma habilidade extraída ainda." />
          )}
        </PanelCard>

        <PanelCard
          action={
            <SectionActionButtons
              activeSection={activeSection}
              isPending={isPending}
              onCancel={resetToSnapshot}
              onEdit={() => onActiveSectionChange("education")}
              onSave={saveSection}
              section="education"
            />
          }
          icon={GraduationCap}
          title="Formação acadêmica"
        >
          {activeSection === "education" ? (
            <div className="space-y-3">
              {draft.education.map((education, index) => (
                <div
                  className="grid gap-3 rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4 md:grid-cols-2"
                  key={education.clientId}
                >
                  <div className="md:col-span-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-stone-100">
                        Formação {index + 1}
                      </p>
                      <p className="text-sm text-stone-400">
                        Instituição, curso e período.
                      </p>
                    </div>
                    <Button
                      className="border-white/10 text-stone-200 hover:bg-white/[0.04]"
                      onClick={() =>
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
                      size="sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <FormField label="Instituição">
                    <Input
                      onChange={(event) =>
                        updateEducation(education.clientId, (current) => ({
                          ...current,
                          institution: event.target.value,
                        }))
                      }
                      value={education.institution}
                    />
                  </FormField>
                  <FormField label="Curso ou grau">
                    <Input
                      onChange={(event) =>
                        updateEducation(education.clientId, (current) => ({
                          ...current,
                          degree: event.target.value,
                        }))
                      }
                      value={education.degree}
                    />
                  </FormField>
                  <FormField label="Área">
                    <Input
                      onChange={(event) =>
                        updateEducation(education.clientId, (current) => ({
                          ...current,
                          field: event.target.value,
                        }))
                      }
                      value={education.field}
                    />
                  </FormField>
                  <FormField label="Início">
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
                  </FormField>
                  <FormField className="md:col-span-2" label="Fim">
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
                  </FormField>
                </div>
              ))}

              <Button
                className="h-11 rounded-[1rem] border-emerald-400/18 bg-emerald-500/8 text-emerald-100 hover:bg-emerald-500/14"
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
                type="button"
                variant="outline"
              >
                <Plus className="size-4" />
                Adicionar formação
              </Button>
            </div>
          ) : draft.education.length > 0 ? (
            <div className="space-y-4">
              {draft.education.map((education) => (
                <article key={education.clientId}>
                  <h4 className="text-[1.08rem] text-stone-100">
                    {[education.degree, education.field].filter(Boolean).join(" em ") ||
                      "Formação registrada"}
                  </h4>
                  <p className="mt-1 text-[1rem] text-emerald-300/88">
                    {education.institution}
                  </p>
                  <p className="mt-1 text-sm text-stone-400">
                    {formatEducationPeriod(education.startDate, education.endDate)}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <EmptyBlock text="Nenhuma formação cadastrada ainda." />
          )}
        </PanelCard>
      </section>
    </div>
  );
}

function PanelCard({
  action,
  children,
  icon: Icon,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  icon: React.ComponentType<React.ComponentProps<"svg">>;
  title: string;
}) {
  return (
    <section className="relative rounded-[1.55rem] border border-white/7 bg-[linear-gradient(180deg,rgba(25,30,27,0.98),rgba(20,24,22,0.98))] px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)]">
      {action ? <div className="absolute top-5 right-5 z-10">{action}</div> : null}
      <div className="mb-4 flex items-center gap-3 pr-28">
        <span className="flex size-9 items-center justify-center rounded-full border border-emerald-400/16 bg-emerald-500/8 text-emerald-200">
          <Icon className="size-4" />
        </span>
        <h3 className="font-[family:var(--font-profile-display)] text-[1.9rem] leading-none text-stone-100">
          {title}
        </h3>
      </div>
      {children}
    </section>
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isActive ? (
        <>
          <Button
            className="h-9 rounded-[0.85rem] border-white/10 text-stone-200 hover:bg-white/[0.04]"
            onClick={onCancel}
            size="sm"
            type="button"
            variant="outline"
          >
            <X className="size-4" />
            Cancelar
          </Button>
          <Button
            className="h-9 rounded-[0.85rem] border-emerald-400/18 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/16"
            disabled={isPending}
            onClick={onSave}
            size="sm"
            type="button"
            variant="outline"
          >
            {isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar
          </Button>
        </>
      ) : (
        <Button
          className="h-9 rounded-[0.85rem] border-emerald-400/18 bg-emerald-500/8 text-emerald-100 hover:bg-emerald-500/14"
          disabled={isDisabled}
          onClick={onEdit}
          size="sm"
          type="button"
          variant="outline"
        >
          <PenLine className="size-4" />
          Editar
        </Button>
      )}
    </div>
  );
}

function ContactLine({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<React.ComponentProps<"svg">>;
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 text-sm text-stone-300/82">
      <span className="flex size-8 items-center justify-center rounded-full border border-white/8 bg-white/[0.03] text-stone-300/72">
        <Icon className="size-4" />
      </span>
      <span>{text}</span>
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 text-sm">
      <span className="text-stone-400">{label}</span>
      <span className="text-stone-200/88">{value}</span>
    </div>
  );
}

function FormField({
  children,
  className,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={cn("grid gap-2 text-sm text-stone-300", className)}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-[1.1rem] border border-dashed border-white/10 bg-white/[0.02] px-4 py-4 text-sm leading-7 text-stone-400">
      {text}
    </div>
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

function getInitials(fullName: string) {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function formatWorkModel(value: ProfileReviewData["workModelPreference"]) {
  return (
    WORK_MODEL_OPTIONS.find((option) => option.value === value)?.label ??
    "Não definido"
  );
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
  return `${formatMonthYear(startDate)} - ${endDate ? formatMonthYear(endDate) : "Atual"}`;
}

function formatEducationPeriod(startDate: string, endDate: string) {
  if (!startDate && !endDate) {
    return "Período não informado";
  }

  return `${startDate ? formatMonthYear(startDate) : "Início não informado"} - ${endDate ? formatMonthYear(endDate) : "Em andamento"}`;
}

function formatMonthYear(value: string) {
  const [year, month] = value.split("-");

  if (!year || !month) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(new Date(Number(year), Number(month) - 1, 1));
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
