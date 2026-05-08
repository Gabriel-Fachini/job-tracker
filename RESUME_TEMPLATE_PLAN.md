# Plano — Template LaTeX base para currículo gerado

Fatia inicial da Fase 5B (`.specs/tasks.md` §5.1/5.2). Objetivo desta fatia: produzir **um template `.tex` parametrizado, um renderizador determinístico e uma fixture de teste** que comprovem o pipeline `dados → .tex → .pdf` antes de envolver IA, banco ou Server Actions.

Fora de escopo desta fatia (ficam para fatias posteriores):
- Server Action `generateResume`
- Integração com Ollama / prompt de geração
- Persistência na tabela `resumes`
- UI dentro do modal de candidatura
- Route Handler `GET /api/resumes/[id]/pdf`

---

## 1. Decisão de design

### 1.1 Estratégia de template
Usar **substituição de placeholders + loops** via [`mustache`](https://www.npmjs.com/package/mustache). Motivos:
- Zero conflito sintático com LaTeX (`\section{...}` usa `{}`, Mustache usa `{{...}}`).
- Loops nativos (`{{#experiences}}...{{/experiences}}`) — necessários para experiências, bullets, skills, projects, education.
- Sem dependência pesada; ~3KB.

Alternativas descartadas:
- Template literals JS — exigiria escapar `${}` em código LaTeX. Ruim.
- Handlebars — overkill.
- ejs — sintaxe `<%= %>` colide menos, mas Mustache é mais simples e o time já usa convenção `{{var}}` em prompts.

### 1.2 Escape LaTeX
Mustache faz HTML-escape por padrão. **Desabilitar** com tags triplas `{{{var}}}` ou usar `Mustache.escape = identity` e fazer escape LaTeX explícito em todo input proveniente do banco.

Caracteres a escapar: `\ { } $ & # ^ _ ~ %`. Implementar em `escapeLatex(s: string)`.

### 1.3 Classe LaTeX
Usar `article` com pacotes leves e disponíveis no Tectonic sem config extra:
- `geometry` — margens
- `enumitem` — bullets compactas
- `titlesec` — cabeçalhos de seção
- `hyperref` — links clicáveis
- `xcolor` — cor de destaque
- `fontenc` (T1) + `inputenc` (utf8) — acentos PT-BR

Nada de XeLaTeX/fontes custom nesta fatia. Tectonic baixa pacotes automaticamente.

---

## 2. Estrutura de arquivos a criar

```
src/lib/latex/
├── template.tex                # template Mustache (LaTeX)
├── escape.ts                   # escapeLatex(input)
├── render.ts                   # renderResumeTex(data: ResumeTemplateData): string
├── types.ts                    # tipo ResumeTemplateData
└── __fixtures__/
    └── sample-profile.ts       # fixture determinística para teste

scripts/
└── render-resume-sample.ts     # CLI dev: renderiza fixture → .tex → tectonic → .pdf
```

Saída de teste vai para `uploads/resumes/generated/__sample__/` (ignorada pelo git via padrão existente).

---

## 3. Contrato de dados — `ResumeTemplateData`

Definir em [src/lib/latex/types.ts](src/lib/latex/types.ts). Reflete o schema do perfil (`.specs/design.md` §schema), mas **achatado** para template — sem IDs, sem timestamps, sem nulls (campos opcionais viram `undefined` e ficam ausentes via Mustache section).

```ts
export type ResumeTemplateData = {
  fullName: string;
  headline?: string;          // ex: "Senior Backend Engineer"
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  location?: string;
  summary?: string;           // parágrafo livre, gerado por IA em fatia futura

  experiences: Array<{
    company: string;
    role: string;
    startDate: string;        // já formatado humano: "Mar 2022"
    endDate: string;          // "Atual" se isCurrent
    location?: string;
    bullets: Array<{ content: string }>;
  }>;

  skills: Array<{
    category: string;         // "Linguagens", "Frameworks", "Ferramentas"
    items: string;            // já joined: "TypeScript, Go, Python"
  }>;

  projects: Array<{
    name: string;
    url?: string;
    stack?: string;           // joined
    description?: string;
    impact?: string;
  }>;

  education: Array<{
    institution: string;
    degree?: string;
    field?: string;
    period?: string;          // "2018 — 2022"
  }>;
};
```

Datas e arrays são **pré-formatados pelo caller** (próxima fatia: adapter `profile → ResumeTemplateData`). Esta fatia consome `ResumeTemplateData` direto.

---

## 4. Conteúdo do template `template.tex`

Estrutura mínima viável. Cada seção condicional via `{{#section}}...{{/section}}` para sumir quando vazia.

Esqueleto a implementar:

```latex
\documentclass[11pt,a4paper]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[margin=1.8cm]{geometry}
\usepackage{enumitem}
\usepackage{titlesec}
\usepackage[hidelinks]{hyperref}
\usepackage{xcolor}

\setlist[itemize]{leftmargin=*,nosep,topsep=2pt}
\titleformat{\section}{\large\bfseries\color{black!85}}{}{0pt}{}[\titlerule]
\titlespacing*{\section}{0pt}{10pt}{6pt}
\pagestyle{empty}

\begin{document}

% ---------- HEADER ----------
\begin{center}
{\LARGE \textbf{ {{{fullName}}} }} \\[2pt]
{{#headline}}{\large {{{headline}}} } \\[4pt]{{/headline}}
{{#location}}{{{location}}}{{/location}}{{#location}}{{#email}} \textbar{} {{/email}}{{/location}}{{#email}}\href{mailto:{{{email}}}}{ {{{email}}} }{{/email}}{{#phone}} \textbar{} {{{phone}}}{{/phone}} \\
{{#linkedin}}\href{ {{{linkedin}}} }{LinkedIn}{{/linkedin}}{{#linkedin}}{{#github}} \textbar{} {{/github}}{{/linkedin}}{{#github}}\href{ {{{github}}} }{GitHub}{{/github}}
\end{center}

% ---------- SUMMARY ----------
{{#summary}}
\section*{Resumo}
{{{summary}}}
{{/summary}}

% ---------- EXPERIENCES ----------
{{#experiences.length}}
\section*{Experiência}
{{/experiences.length}}
{{#experiences}}
\textbf{ {{{role}}} } \hfill {{{startDate}}} — {{{endDate}}} \\
\textit{ {{{company}}} }{{#location}} \textbar{} {{{location}}}{{/location}}
{{#bullets.length}}
\begin{itemize}
{{#bullets}}\item {{{content}}}
{{/bullets}}\end{itemize}
{{/bullets.length}}
\vspace{4pt}
{{/experiences}}

% ---------- SKILLS ----------
{{#skills.length}}
\section*{Habilidades}
\begin{itemize}
{{#skills}}\item \textbf{ {{{category}}}: } {{{items}}}
{{/skills}}\end{itemize}
{{/skills.length}}

% ---------- PROJECTS ----------
{{#projects.length}}
\section*{Projetos}
{{/projects.length}}
{{#projects}}
\textbf{ {{{name}}} }{{#url}} \hfill \href{ {{{url}}} }{link}{{/url}} \\
{{#stack}}\textit{ {{{stack}}} } \\{{/stack}}
{{#description}}{{{description}}}{{/description}}
{{#impact}} \\ \textbf{Impacto:} {{{impact}}}{{/impact}}
\vspace{4pt}
{{/projects}}

% ---------- EDUCATION ----------
{{#education.length}}
\section*{Formação}
{{/education.length}}
{{#education}}
\textbf{ {{{institution}}} }{{#period}} \hfill {{{period}}}{{/period}} \\
{{#degree}}{{{degree}}}{{/degree}}{{#field}} — {{{field}}}{{/field}}
\vspace{2pt}
{{/education}}

\end{document}
```

Notas para o agente:
- Triplo-mustache `{{{var}}}` em todos os interpolados — escape é responsabilidade de `escapeLatex`, não do Mustache.
- `{{#array.length}}` é truque Mustache para "renderizar só se array não vazio" — funciona porque arrays JS expõem `length`.
- Espaços entre `{` e conteúdo são intencionais para evitar colisão com `{{`.

---

## 5. `escape.ts`

```ts
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/\\/g, '\\textbackslash{}'],
  [/&/g, '\\&'],
  [/%/g, '\\%'],
  [/\$/g, '\\$'],
  [/#/g, '\\#'],
  [/_/g, '\\_'],
  [/\{/g, '\\{'],
  [/\}/g, '\\}'],
  [/~/g, '\\textasciitilde{}'],
  [/\^/g, '\\textasciicircum{}'],
];

export function escapeLatex(input: string): string {
  return REPLACEMENTS.reduce((s, [re, rep]) => s.replace(re, rep), input);
}
```

Ordem importa: `\\` primeiro para não duplicar escape.

URLs em `linkedin`, `github`, `projects[].url` **não** passam por `escapeLatex` (quebra `https://`). Em vez disso, validar domínio via `URL()` ou rejeitar caracteres perigosos (`} \ %`) — se inválido, omitir o campo.

---

## 6. `render.ts`

```ts
import Mustache from 'mustache';
import fs from 'node:fs';
import path from 'node:path';
import { escapeLatex } from './escape';
import type { ResumeTemplateData } from './types';

Mustache.escape = (s) => s;  // escape é nosso

const TEMPLATE_PATH = path.join(__dirname, 'template.tex');

export function renderResumeTex(data: ResumeTemplateData): string {
  const safe = escapeData(data);
  const tpl = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  return Mustache.render(tpl, safe);
}

function escapeData(d: ResumeTemplateData): ResumeTemplateData {
  // deep map; URLs ficam crus se passarem em isSafeUrl(); senão removidos
  // ... implementar field-by-field, sem reflection genérica
}
```

`escapeData` **não** é genérico — escreve campo a campo. URLs validadas com helper `isSafeUrl(s)`.

---

## 7. Fixture de teste

`src/lib/latex/__fixtures__/sample-profile.ts` exporta `sampleProfile: ResumeTemplateData` com:
- 2 experiências, uma "Atual"
- 1 experiência com 3 bullets contendo `&`, `%`, `_`, `$` para validar escape
- 3 skills (uma com vírgulas e parênteses)
- 1 projeto com URL
- 1 educação
- `summary` curto com acento PT-BR

Agente deve verificar visualmente que caracteres especiais aparecem corretos no PDF — não como comandos LaTeX malformados.

---

## 8. Script de verificação `scripts/render-resume-sample.ts`

CLI executável via `tsx`:

```ts
import { renderResumeTex } from '@/lib/latex/render';
import { sampleProfile } from '@/lib/latex/__fixtures__/sample-profile';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('uploads/resumes/generated/__sample__');
fs.mkdirSync(outDir, { recursive: true });

const tex = renderResumeTex(sampleProfile);
const texPath = path.join(outDir, 'sample.tex');
fs.writeFileSync(texPath, tex, 'utf8');

execFileSync('tectonic', [texPath, '--outdir', outDir], { stdio: 'inherit', timeout: 30_000 });
console.log('PDF:', path.join(outDir, 'sample.pdf'));
```

Adicionar npm script `"resume:sample": "tsx scripts/render-resume-sample.ts"`.

---

## 9. Pré-requisito Tectonic

Antes de rodar o script, agente verifica:

```bash
which tectonic && tectonic --version
```

Se ausente, instruir instalação (`brew install tectonic` no macOS) — **não** instalar automaticamente. Documentar no README em seção `## Geração de currículos`. Não criar arquivo novo de docs; editar README existente.

---

## 10. Critérios de aceitação

A fatia é dada por concluída quando:

1. `npm run resume:sample` gera `uploads/resumes/generated/__sample__/sample.pdf` sem erro.
2. PDF abre e exibe:
   - Nome, contato, links clicáveis no header
   - Seções Resumo, Experiência, Habilidades, Projetos, Formação na ordem
   - Bullets de experiência com caracteres `&`, `%`, `_`, `$` renderizados literal (não como comando LaTeX nem ausentes)
   - Acento PT-BR correto
3. Remover qualquer seção da fixture (ex: zerar `projects: []`) faz a seção sumir do PDF — não deixa cabeçalho órfão.
4. `escapeLatex('100% de cobertura & R$ 5_000')` retorna string válida em LaTeX (verificável por unit test simples).
5. Tipo `ResumeTemplateData` exportado e importável de `@/lib/latex`.

---

## 11. Ordem de execução para o agente

1. `npm i mustache @types/mustache`
2. Criar `src/lib/latex/types.ts`
3. Criar `src/lib/latex/escape.ts` + teste unit (`escape.test.ts`) cobrindo cada caractere
4. Criar `src/lib/latex/template.tex`
5. Criar `src/lib/latex/render.ts` com `escapeData` campo a campo
6. Criar fixture
7. Criar `scripts/render-resume-sample.ts`
8. Adicionar npm script
9. Rodar `npm run resume:sample`, abrir PDF, validar critérios
10. Commit: `feat(resume): latex template + renderer + sample compiler`

Não tocar em: schema do banco, Server Actions, Ollama, UI, Route Handlers. Tudo isso vem na próxima fatia.

---

## 12. Riscos e mitigações

| Risco | Mitigação |
|-------|-----------|
| Tectonic baixa pacotes na primeira run e demora >30s | Primeira execução manual fora do timeout; runs subsequentes usam cache |
| Mustache HTML-escape default corromper LaTeX | `Mustache.escape = identity` no topo de `render.ts` — checar em test |
| URL com `%` (encoding) quebrar `\href` | Validar com `new URL()` e rejeitar URLs com `}` ou `\` no path |
| Bullets longos estourando linha | Aceitável nesta fatia; ajuste tipográfico fica para fatia de polish |
| Diferença entre Tectonic local e CI | CI fora de escopo nesta fatia |
