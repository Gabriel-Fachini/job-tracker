# Módulo: Geração de currículo (LaTeX → PDF)

Gera um PDF personalizado para uma candidatura: a IA escolhe e reescreve bullets e skills a partir do perfil e da descrição da vaga; um template LaTeX monta o documento; o `tectonic` compila.

## Arquivos

| Arquivo | Papel |
|---|---|
| [`src/server/actions/resume.ts`](../../src/server/actions/resume.ts) | `generateResume(applicationId)` |
| [`src/lib/ai/resume-generation.ts`](../../src/lib/ai/resume-generation.ts) | prompt + parse da seleção (Ollama) |
| [`src/lib/latex/profile-adapter.ts`](../../src/lib/latex/profile-adapter.ts) | perfil + seleção → `ResumeTemplateData` |
| [`src/lib/latex/render.ts`](../../src/lib/latex/render.ts) | escape + Mustache → `.tex` |
| [`src/lib/latex/escape.ts`](../../src/lib/latex/escape.ts) | escape LaTeX e validação de URL |
| [`src/lib/latex/template.tex`](../../src/lib/latex/template.tex) | template (delimitadores `<< >>`) |
| [`src/lib/latex/types.ts`](../../src/lib/latex/types.ts) | `ResumeTemplateData` |
| [`src/lib/latex/__fixtures__/sample-profile.ts`](../../src/lib/latex/__fixtures__/sample-profile.ts) | perfil fictício para teste e amostra |
| [`scripts/render-resume-sample.ts`](../../scripts/render-resume-sample.ts) | `npm run resume:sample` |
| [`src/app/api/applications/[id]/generated-resume/route.ts`](../../src/app/api/applications/[id]/generated-resume/route.ts) | serve o PDF gerado |

## Fluxo

1. Disparo: automaticamente após criar/promover candidatura (`ApplicationCreateModal`) ou pelos botões "Gerar currículo"/"Gerar novamente" no detalhe.
2. `generateResume` busca candidatura ⨝ job ⨝ empresa. Exige perfil (`getProfileSnapshot`) e `jobs.description` não vazia.
3. `generateResumeSelection(profile, job)` chama o motor de geração (`GENERATION_ENGINE`: OpenAI `gpt-6-sol` com `json_object` por padrão; Ollama com `format: "json"`, `temperature: 0` no fallback) com:
   - vaga (empresa, título, descrição);
   - experiências com bullets, skills (`categoria: nome`), projetos com stack.
   O system prompt pede, por experiência, 2 a 5 bullets reescritos em STAR sem inventar métricas; skills agrupadas por categoria em pt-BR; para tecnologias da vaga ausentes nas skills, a categoria "Projetos & Experiência Prática" (`Tecnologia — Projeto`) quando há projeto pessoal, ou "Interesse Técnico" quando não há; e no máximo 2 projetos em `projects`, só com aderência direta.
4. `parseResumeSelectionResponse`: tira cercas, desembrulha `result`/`output`/`data`/`response` se o modelo aninhar, limita projetos a 2.
5. `buildResumeData`: casa bullets por nome de empresa (exato em minúsculas, depois "um contém o outro"); datas `YYYY-MM` → `MM/YYYY`, atual → "Atual"; projetos filtrados pela seleção (match flexível sem acento); educação com período formatado.
6. `renderResumeTex`: escapa tudo (`\ & % $ # _ { } ~ ^`), aceita URL só se `new URL()` passar e não tiver `\ { } %`, e renderiza com Mustache (`Mustache.escape` desligado, delimitadores `<< >>`). Seções vazias somem (`<<#lista.length>>`).
7. Grava `.tex` e compila com `execFileSync("tectonic", [tex, "--outdir", dir])`, timeout 60 s. É síncrono: durante a compilação o event loop do Node fica bloqueado (inclusive o SSE do radar).
8. Salva o caminho **absoluto** do PDF em `applications.generated_resume_path`.

Saída: `<UPLOADS_PATH>/resumes/generated/<Nome>_<Empresa>_<AAAA-MM>_<HH-MM>.pdf` (+ `.tex`). A empresa passa por `sanitizeFilename` (sem acento, só `[A-Za-z0-9_-]`).

`GET /api/applications/[id]/generated-resume` lê o arquivo e responde `application/pdf` inline; 404 se não houver caminho.

## Currículo em inglês (`language: "en"`)

Usado pelo kit de candidatura assistida ([candidaturas.md](candidaturas.md#candidatura-assistida-kit)); a lógica compartilhada fica em [`src/lib/resume/generate.ts`](../../src/lib/resume/generate.ts), e o fluxo pt-BR acima não muda.

- Prompt em inglês; a seleção também devolve `headline` e `summary` (2–3 frases), que o template já suportava.
- Cabeçalhos do template localizados em `render.ts` (ex.: `SUMMARY`).
- Sem a seção de idiomas (o perfil não tem esse dado; melhor omitir do que declarar um nível) e sem o "Brasil" fixo na formação.
- Arquivo com sufixo `_en` no nome.
- O motor é o de geração (`GENERATION_ENGINE`, OpenAI `gpt-6-sol` por padrão), igual ao pt-BR.

## Valores fixos no código

- Prefixo do nome do arquivo com o nome do autor (`resume.ts`).
- Só no pt-BR: idiomas "Português — Nativo" e "Inglês — Avançado" e `location: "Brasil"` em toda formação (`profile-adapter.ts`).
- `summary`/`headline` só no inglês.

Para outro usuário, esses pontos precisam virar dados do perfil.

## Requisitos

- Binário `tectonic` no `PATH` (no Mac: Homebrew). O `deploy/install.sh` **não** instala; na VPS é passo manual.
- Perfil com experiências e descrição da vaga preenchida.
- Ollama configurado (ver [ia.md](../ia.md)).

## Amostra e testes

```bash
npm run resume:sample   # renderiza o perfil fictício em uploads/resumes/generated/__sample__/sample.pdf
npm run test:escape     # só escape.test.ts
```

`SAMPLE_PROFILE_*` (ver `.env.example`) sobrescreve a identidade do perfil fictício. O script ignora `UPLOADS_PATH` e sempre grava em `uploads/resumes/generated/__sample__`. Testes de `render`, `profile-adapter` e `resume-generation` rodam com o comando geral em [testes-e-qualidade.md](../testes-e-qualidade.md).

## Armadilhas

- A tabela `resumes` não é usada (o KPI "Currículos gerados" do dashboard fica em 0).
- Caminho absoluto em `generated_resume_path` quebra se o diretório de uploads mudar de lugar (ex.: migração Mac → VPS).
- O `.tex` e o PDF antigos não são apagados ao gerar de novo; cada geração cria um arquivo com novo timestamp.
- O log `[resume] aiSelection:` imprime a seleção completa no stdout do servidor.
