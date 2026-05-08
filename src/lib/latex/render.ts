import Mustache from 'mustache';
import fs from 'node:fs';
import path from 'node:path';
import { escapeLatex, isSafeUrl } from './escape';
import type { ResumeTemplateData } from './types';

Mustache.escape = (s) => s;

const TEMPLATE_PATH = path.join(process.cwd(), 'src/lib/latex/template.tex');

export function renderResumeTex(data: ResumeTemplateData): string {
  const safe = escapeData(data);
  const languagesLine = safe.languages?.length
    ? safe.languages
        .map((l) => `{\\bfseries ${l.name}:} ${l.level}`)
        .join(' \\textbf{|} ')
    : undefined;
  const tpl = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return Mustache.render(tpl, { ...safe, languagesLine }, {}, ['<<', '>>']);
}

function safeUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return isSafeUrl(url) ? url : undefined;
}

function escapeData(d: ResumeTemplateData): ResumeTemplateData {
  return {
    fullName: escapeLatex(d.fullName),
    headline: d.headline ? escapeLatex(d.headline) : undefined,
    email: d.email ? escapeLatex(d.email) : undefined,
    phone: d.phone ? escapeLatex(d.phone) : undefined,
    linkedin: safeUrl(d.linkedin),
    github: safeUrl(d.github),
    location: d.location ? escapeLatex(d.location) : undefined,
    summary: d.summary ? escapeLatex(d.summary) : undefined,

    experiences: d.experiences.map((exp) => ({
      company: escapeLatex(exp.company),
      role: escapeLatex(exp.role),
      startDate: escapeLatex(exp.startDate),
      endDate: escapeLatex(exp.endDate),
      location: exp.location ? escapeLatex(exp.location) : undefined,
      bullets: exp.bullets.map((b) => ({ content: escapeLatex(b.content) })),
    })),

    skills: d.skills.map((s) => ({
      category: escapeLatex(s.category),
      items: escapeLatex(s.items),
    })),

    languages: d.languages?.map((l) => ({
      name: escapeLatex(l.name),
      level: escapeLatex(l.level),
    })),

    projects: d.projects.map((p) => ({
      name: escapeLatex(p.name),
      url: safeUrl(p.url),
      stack: p.stack ? escapeLatex(p.stack) : undefined,
      description: p.description ? escapeLatex(p.description) : undefined,
      impact: p.impact ? escapeLatex(p.impact) : undefined,
    })),

    education: d.education.map((e) => ({
      institution: escapeLatex(e.institution),
      degree: e.degree ? escapeLatex(e.degree) : undefined,
      field: e.field ? escapeLatex(e.field) : undefined,
      period: e.period ? escapeLatex(e.period) : undefined,
      location: e.location ? escapeLatex(e.location) : undefined,
    })),
  };
}
