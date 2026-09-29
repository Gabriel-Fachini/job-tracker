"use client";

import { useMemo, useState } from "react";

import { formatMonthYear, formatOneDecimal } from "@/components/glassdoor/format";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { MetaLine } from "@/components/ui/meta-line";
import { Tag, type TagColor } from "@/components/ui/tag";
import { isTechTitle } from "@/lib/glassdoor/constants";
import type { GlassdoorInterviewItem, GlassdoorView } from "@/lib/glassdoor/view";

const PAGE_SIZE = 6;

const DIFFICULTY: Record<string, string> = {
  VERY_EASY: "Muito fácil",
  EASY: "Fácil",
  AVERAGE: "Média",
  DIFFICULT: "Difícil",
  VERY_DIFFICULT: "Muito difícil",
};

const OUTCOME: Record<string, string> = {
  NO_OFFER: "Sem oferta",
  ACCEPT_OFFER: "Aceitou a oferta",
  DECLINE_OFFER: "Recusou a oferta",
};

const EXPERIENCE: Record<string, { label: string; color: TagColor }> = {
  POSITIVE: { label: "Experiência positiva", color: "green" },
  NEUTRAL: { label: "Experiência neutra", color: "gray" },
  NEGATIVE: { label: "Experiência negativa", color: "red" },
};

const CHANNEL: Record<string, string> = {
  APPLIED_ONLINE: "Candidatura online",
  RECRUITER: "Recrutador",
  EMPLOYEE_REFERRAL: "Indicação",
  STAFFING_AGENCY: "Agência",
  CAMPUS_RECRUITING: "Universidade",
  IN_PERSON: "Presencial",
  OTHER: "Outro",
};

export function InterviewsTab({ interviews }: { interviews: GlassdoorView["interviews"] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);

  // Technology roles first (they prepare the user best), newest first inside each group.
  const ordered = useMemo(
    () =>
      [...interviews.items].sort((a, b) => {
        const techDiff = Number(isTechTitle(b.jobTitle)) - Number(isTechTitle(a.jobTitle));
        return techDiff || (b.date ?? "").localeCompare(a.date ?? "");
      }),
    [interviews.items],
  );
  const techCount = ordered.filter((item) => isTechTitle(item.jobTitle)).length;

  const experienceTotal =
    (interviews.positive ?? 0) + (interviews.neutral ?? 0) + (interviews.negative ?? 0);
  const channels = Object.entries(interviews.channelCounts ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="divide-y divide-border">
      <div className="flex flex-col gap-5 p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat
            label="Dificuldade"
            value={interviews.difficulty !== null ? formatOneDecimal(interviews.difficulty) : "–"}
            suffix=" / 5"
          />
          <Stat
            label="Duração mediana"
            value={interviews.medianDurationDays !== null ? String(Math.round(interviews.medianDurationDays)) : "–"}
            suffix=" dias"
          />
          <Stat
            label="Aceitaram a oferta"
            value={`${interviews.accepted}/${interviews.items.length}`}
          />
        </dl>

        {experienceTotal > 0 ? (
          <div>
            <p className="text-xs font-medium text-subtle-foreground">Experiência</p>
            <div
              role="img"
              aria-label={`${interviews.positive ?? 0} positivas, ${interviews.neutral ?? 0} neutras, ${interviews.negative ?? 0} negativas`}
              className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full"
            >
              <span className="bg-positive" style={{ flexGrow: interviews.positive ?? 0 }} />
              <span className="bg-chart-5" style={{ flexGrow: interviews.neutral ?? 0 }} />
              <span className="bg-negative" style={{ flexGrow: interviews.negative ?? 0 }} />
            </div>
            <p className="mt-1.5 text-xs text-subtle-foreground">
              <span className="font-data">{interviews.positive ?? 0}</span> positivas ·{" "}
              <span className="font-data">{interviews.neutral ?? 0}</span> neutras ·{" "}
              <span className="font-data">{interviews.negative ?? 0}</span> negativas
            </p>
          </div>
        ) : null}

        {channels.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-subtle-foreground">Como chegaram à vaga</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {channels.map(([key, count]) => (
                <li key={key}>
                  <Chip>
                    {CHANNEL[key] ?? key} <span className="font-data">{count}</span>
                  </Chip>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div>
        <div className="px-4 py-3 sm:px-5">
          <p className="text-xs text-subtle-foreground">
            <span className="font-data">{ordered.length}</span> relatos
            {techCount > 0 ? (
              <>
                {" "}
                · <span className="font-data">{techCount}</span> de tecnologia primeiro
              </>
            ) : null}
          </p>
        </div>

        {ordered.length === 0 ? (
          <p className="px-4 pb-8 text-center text-[13px] text-subtle-foreground sm:px-5">
            Nenhum relato de entrevista importado.
          </p>
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {ordered.slice(0, visible).map((item) => (
              <li key={item.id} className="flex flex-col gap-2 px-4 py-4 sm:px-5">
                <InterviewRow item={item} />
              </li>
            ))}
          </ul>
        )}

        {ordered.length > visible ? (
          <div className="flex justify-center border-t border-border px-4 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setVisible((value) => value + PAGE_SIZE)}
            >
              Mostrar mais <span className="font-data">{Math.min(PAGE_SIZE, ordered.length - visible)}</span>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="min-w-0">
      <dd className="font-data text-xl leading-none font-semibold text-foreground">
        {value}
        {suffix ? (
          <span className="text-[13px] font-medium text-subtle-foreground">{suffix}</span>
        ) : null}
      </dd>
      <dt className="mt-1.5 text-[13px] text-muted-foreground">{label}</dt>
    </div>
  );
}

function InterviewRow({ item }: { item: GlassdoorInterviewItem }) {
  const experience = item.experience ? EXPERIENCE[item.experience] : null;

  return (
    <>
      <h3 className="min-w-0 text-sm leading-snug font-medium break-words text-foreground">
        {item.jobTitle ?? "Cargo não informado"}
      </h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {experience ? <Tag color={experience.color}>{experience.label}</Tag> : null}
        {item.difficulty ? (
          <Tag>{DIFFICULTY[item.difficulty] ?? item.difficulty}</Tag>
        ) : null}
        {item.outcome ? <Tag>{OUTCOME[item.outcome] ?? item.outcome}</Tag> : null}
      </div>
      <MetaLine
        items={[
          <span key="date" className="font-data">
            {formatMonthYear(item.date)}
          </span>,
          item.durationDays ? (
            <span key="days">
              <span className="font-data">{item.durationDays}</span> dias de processo
            </span>
          ) : null,
        ]}
      />
      {item.process ? (
        <p className="max-w-[68ch] text-[13px] leading-5 text-pretty break-words whitespace-pre-line text-muted-foreground">
          {item.process}
        </p>
      ) : null}
      {item.questions.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-subtle-foreground">Perguntas</p>
          <ul className="mt-1 flex max-w-[68ch] flex-col gap-1">
            {item.questions.map((question, index) => (
              <li
                key={index}
                className="border-l-2 border-border-strong pl-3 text-[13px] leading-5 text-pretty break-words text-muted-foreground"
              >
                {question}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
