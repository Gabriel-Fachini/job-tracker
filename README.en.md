# Job Tracker

[Versao em PT-BR](README.md)

![Next.js](https://img.shields.io/badge/Next.js-16-111111?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-0b1020?style=flat-square&logo=react&logoColor=61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-6-0f172a?style=flat-square&logo=typescript&logoColor=3178c6)
![SQLite](https://img.shields.io/badge/SQLite-local-0f172a?style=flat-square&logo=sqlite&logoColor=74c0fc)
![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-c5f74f?style=flat-square&logo=drizzle&logoColor=111111)
![TanStack Query](https://img.shields.io/badge/TanStack-Query-1f2937?style=flat-square&logo=reactquery&logoColor=ff4154)
![Ollama](https://img.shields.io/badge/Ollama-runtime-111111?style=flat-square)
![OpenAI](https://img.shields.io/badge/OpenAI-optional-0f172a?style=flat-square&logo=openai&logoColor=white)

Job Tracker is a personal, local-first product built to manage job hunting with less friction and more context. Instead of being just another applications board, it combines a structured professional profile, manual job-board monitoring, AI-assisted lead classification, and analytics to answer a more useful question: where is my process working, and where is it breaking down?

## Overview

The system is designed for single-user usage, with a strong focus on privacy, iteration speed, and low operational cost. Data lives in a local SQLite database, and the entire product runs as a full-stack Next.js web app.

The current product already delivers an end-to-end functional flow for:

- keeping a structured professional profile extracted from a PDF resume;
- registering companies and tracking their status;
- running a manual job radar against job boards;
- triaging automatically discovered leads before they become applications;
- tracking applications in a board with stage history;
- visualizing funnel metrics and monitoring signals in an analytics dashboard.

## Core Workflows

### 1. Professional profile

The user uploads a master resume in PDF format, the text is extracted, structured with AI, and stored inside the app as editable data. Review happens inline by section, without depending on external files.

### 2. Manual job radar

Companies can be registered with a `jobsBoardUrl`. A manual scan discovers job links, extracts structured signals from job descriptions, and classifies fit against the saved profile.

### 3. Lead triage inbox

Jobs classified as relevant or uncertain are sent to `/leads`, where the user can approve, discard, or promote a lead into the application pipeline.

### 4. Application pipeline

Applications are tracked in a visual board with statuses, a detail modal, stage history, and operational metadata about each hiring process.

### 5. Dashboard

The dashboard consolidates backlog, funnel, classification distribution, radar timeline, top companies, work-model fit, and classifier quality.

## Technical Highlights

- `Next.js 16` with App Router and Server Actions keeps UI and backend logic in the same repository.
- `SQLite + Drizzle ORM` provides simple, fast, local persistence with migration-based schema evolution.
- `TanStack Query` powers the leads module with flicker-free initial hydration and selective invalidation.
- `SSE` surfaces radar progress in real time without queues, workers, or extra infrastructure.
- `Ollama` is used for lead classification and resume-related text generation/selection flows.
- `OpenAI` is currently used in the profile extraction flow and can optionally format job descriptions.
- `Playwright + fetch + cheerio` cover both simpler job boards and more dynamic navigation cases.

## Architecture

```text
UI (Next.js / React)
  -> Server Actions + Route Handlers
  -> SQLite (Drizzle)
  -> Local file system (uploads, backups)
  -> Ollama runtime (local or cloud)
  -> OpenAI API (profile extraction and optional formatting)
```

Key architectural decisions:

- `local-first`: this is a personal product, so it avoids auth, cloud sync, and unnecessary infrastructure.
- `manual by design`: radar execution is user-triggered, not scheduled.
- `lead vs application separation`: not every discovered role becomes an application.
- `real-time without over-engineering`: SSE is enough for monitoring feedback in this context.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript |
| UI | Tailwind CSS 4, Base UI, shadcn/ui, Lucide |
| Client-side state | TanStack Query |
| Database | SQLite |
| ORM | Drizzle ORM |
| AI | Ollama, OpenAI |
| Extraction / scraping | fetch, cheerio, Playwright |
| Charts | Recharts |

## Project Structure

```text
src/
  app/
    (app)/
      dashboard/
      profile/
      companies/
      leads/
      applications/
    api/
  components/
  lib/
    ai/
    db/
    job-monitoring/
    profile/
  providers/
  server/
    actions/
scripts/
docs/
public/
uploads/
```

Useful entry points:

- [src/lib/job-monitoring/index.ts](src/lib/job-monitoring/index.ts)
- [src/lib/job-monitoring/classification.ts](src/lib/job-monitoring/classification.ts)
- [src/app/api/monitoring/stream/route.ts](src/app/api/monitoring/stream/route.ts)
- [src/components/leads/monitoring-progress-context.tsx](src/components/leads/monitoring-progress-context.tsx)
- [src/server/actions/profile.ts](src/server/actions/profile.ts)
- [src/server/queries/dashboard.ts](src/server/queries/dashboard.ts)
- [docs/radar-manual-de-vagas-implementacao.md](docs/radar-manual-de-vagas-implementacao.md)

## Running Locally

### 1. Install dependencies

```bash
npm install
cp .env.example .env.local
```

### 2. Set up the database

```bash
npm run db:migrate
```

If you plan to change the schema or run new migrations, create a backup first:

```bash
npm run db:backup
```

### 3. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

`.env.example` documents the minimum setup. At a high level:

- `DATABASE_URL`: local SQLite database path.
- `OPENAI_API_KEY`: currently required for profile extraction.
- `OPENAI_COMPARISON_MODEL`: optional model for comparison and OpenAI utilities.
- `OPENAI_FORMAT_JOB_DESCRIPTIONS`: enables optional formatting of job descriptions.
- `OLLAMA_RUNTIME_MODE`: `local` or `cloud`.
- `OLLAMA_BASE_URL`: Ollama runtime endpoint.
- `OLLAMA_MODEL`: model used for classification and text generation.
- `OLLAMA_API_KEY`: required when using `cloud` mode.
- `OLLAMA_TIMEOUT_MS`: timeout for Ollama requests.
- `UPLOADS_PATH`: base directory for local uploads.

## Useful Scripts

```bash
npm run dev
npm run build
npm run lint
npm run db:generate
npm run db:migrate
npm run db:backup
npm run db:restore
npm run test:job-monitoring
npm run test:profile-extraction
npm run analyze:profile-extractions
npm run resume:sample
```

## Current Scope

This repository represents a functional personal product, but it deliberately does not try to solve everything:

- no authentication or multi-tenant support;
- no cloud sync;
- radar remains manual, not scheduled;
- broader job-board coverage can be expanded over time;
- the product prioritizes operational clarity and fast iteration over heavy automation.

## Roadmap

Natural next steps for the product:

- expand provider coverage and board-navigation support;
- deepen the custom resume generation flow inside applications;
- improve funnel diagnostics and analytics;
- refine classifier heuristics and its feedback loop.

## Portfolio Context

This project exists because I wanted a tool that reflects my real job-hunting process, not a generic CRUD app. The most interesting part, for me, is the mix of product thinking and technical pragmatism: AI where it actually helps, local data by default, and an architecture simple enough to keep evolving quickly.
