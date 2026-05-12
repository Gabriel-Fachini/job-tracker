# Projetos Pessoais

Resumo dos projetos do portfólio para inserção manual no banco de dados.

---

## Projetos

### Job Tracker
- **Repo:** https://github.com/Gabriel-Fachini/job-tracker
- **Descrição:** Aplicação local-first para organizar a busca por vagas com perfil profissional estruturado, monitoramento manual de job boards, triagem de leads com IA e acompanhamento do pipeline de candidaturas.
- **Stack:** TypeScript, Next.js, SQLite, Drizzle ORM, TanStack Query, SSE, Ollama, OpenAI
- **Destaques:** Radar manual de vagas com progresso em tempo real via SSE; triagem separada de leads antes da candidatura; classificação assistida por IA com runtime Ollama configurável por ambiente

---

### Valorize UI
- **Repo:** https://github.com/Gabriel-Fachini/valorize-ui
- **Descrição:** Plataforma corporativa de engajamento com reconhecimento de colaboradores, gamificação e sistema de recompensas. Monorepo com 4 apps: dashboard do colaborador, painel admin (RH/gestor), backoffice multi-tenant e landing page.
- **Stack:** TypeScript, React 19, TailwindCSS v4, TanStack Query, TanStack Router, Shadcn/ui, Turborepo, Astro, Google Cloud Run, PNPM
- **Destaques:** Deploy em Cloud Run com CI/CD; suporte multi-tenant; monorepo com Turborepo gerenciando 4 apps independentes

---

### Valorize API
- **Repo:** https://github.com/Gabriel-Fachini/valorize-api
- **Descrição:** API backend B2B SaaS para a plataforma Valorize. Arquitetura multi-tenant isolada, RBAC com 3 papéis, sistema de carteira/vouchers e auditoria completa.
- **Stack:** TypeScript, Node.js, Fastify, PostgreSQL, Prisma, Supabase Auth, Vitest, ESLint, SonarCloud, Google Cloud Run
- **Destaques:** Arquitetura multi-tenant; sistema de wallet e vouchers; RBAC com 3 papéis; auditoria completa; cobertura de testes com Vitest

---

### AirPlay TV
- **Repo:** https://github.com/Gabriel-Fachini/AirPlay-TV
- **Descrição:** App Android TV que transforma qualquer dispositivo Android TV em receptor AirPlay para espelhamento de tela de dispositivos Apple (iPhone, iPad, Mac).
- **Stack:** Kotlin, C++, NDK, Jetpack Compose TV, MediaCodec, CMake, mDNS, Android Leanback
- **Destaques:** Decodificação de vídeo via hardware (MediaCodec); descoberta automática de rede via mDNS; bridge JNI entre Kotlin e core C++; suporte armeabi-v7a e arm64-v8a

---

### Health AI Assistant
- **Repo:** https://github.com/Gabriel-Fachini/health-ai-assistant
- **Descrição:** Agente conversacional que simula recepcionista médica para agendamento de consultas via linguagem natural. Arquitetura de máquina de estados, suporte multi-LLM sem mudança de código.
- **Stack:** Python, LiteLLM, Pydantic, Tenacity, Rich, Pytest, Ruff, Mypy, Poetry
- **Destaques:** 87 testes; suporte a múltiplos LLMs (OpenAI, Anthropic, Google, Ollama); validação de endereço real-time via ViaCEP/Google Maps

---

### Media Traffic AI Analyst
- **Repo:** https://github.com/Gabriel-Fachini/media-traffic-ai-analyst
- **Descrição:** Agente de analytics em linguagem natural para equipes de mídia e growth. Interpreta queries em português e executa SQL no BigQuery via tool calling estruturado com LLM.
- **Stack:** Python, FastAPI, LangGraph, Claude (Anthropic), GPT-4, BigQuery, Pydantic, Poetry
- **Destaques:** Roteador de intenção; normalização de datas em PT-BR; tool calling auditável (LLM nunca executa SQL direto); suporte multi-turno com contexto por thread

---

## Inserir no banco de dados

```bash
sqlite3 ./job-tracker.db <<'SQL'
INSERT INTO profile_projects (profile_id, name, description, stack, url, impact, created_at)
VALUES
  (
    (SELECT id FROM profile LIMIT 1),
    'Job Tracker',
    'Aplicação local-first para organizar a busca por vagas com perfil profissional estruturado, monitoramento manual de job boards, triagem de leads com IA e acompanhamento do pipeline de candidaturas.',
    '["TypeScript","Next.js","SQLite","Drizzle ORM","TanStack Query","SSE","Ollama","OpenAI"]',
    'https://github.com/Gabriel-Fachini/job-tracker',
    'Radar manual de vagas com progresso em tempo real via SSE; triagem separada de leads antes da candidatura; classificação assistida por IA com runtime Ollama configurável por ambiente',
    CURRENT_TIMESTAMP
  ),
  (
    (SELECT id FROM profile LIMIT 1),
    'Valorize UI',
    'Plataforma corporativa de engajamento: reconhecimento de colaboradores, gamificação e sistema de recompensas. Monorepo com 4 apps (dashboard, admin, backoffice, landing).',
    '["TypeScript","React 19","TailwindCSS v4","TanStack Query","TanStack Router","Shadcn/ui","Turborepo","Astro","Google Cloud Run","PNPM"]',
    'https://github.com/Gabriel-Fachini/valorize-ui',
    'Deploy em Cloud Run com CI/CD; suporte multi-tenant; monorepo com Turborepo gerenciando 4 apps independentes',
    CURRENT_TIMESTAMP
  ),
  (
    (SELECT id FROM profile LIMIT 1),
    'Valorize API',
    'API backend B2B SaaS para a plataforma Valorize. Arquitetura multi-tenant isolada, RBAC, sistema de carteira/vouchers e auditoria completa.',
    '["TypeScript","Node.js","Fastify","PostgreSQL","Prisma","Supabase Auth","Vitest","ESLint","SonarCloud","Google Cloud Run"]',
    'https://github.com/Gabriel-Fachini/valorize-api',
    'Arquitetura multi-tenant; sistema de wallet e vouchers; RBAC com 3 papéis; auditoria completa; cobertura de testes com Vitest',
    CURRENT_TIMESTAMP
  ),
  (
    (SELECT id FROM profile LIMIT 1),
    'AirPlay TV',
    'App Android TV que transforma qualquer dispositivo Android TV em receptor AirPlay para espelhamento de tela de dispositivos Apple.',
    '["Kotlin","C++","NDK","Jetpack Compose TV","MediaCodec","CMake","mDNS","Android Leanback"]',
    'https://github.com/Gabriel-Fachini/AirPlay-TV',
    'Decodificação de vídeo via hardware (MediaCodec); descoberta automática de rede via mDNS; bridge JNI entre Kotlin e core C++; suporte armeabi-v7a e arm64-v8a',
    CURRENT_TIMESTAMP
  ),
  (
    (SELECT id FROM profile LIMIT 1),
    'Health AI Assistant',
    'Agente conversacional que simula recepcionista médica para agendamento de consultas via linguagem natural. Arquitetura de máquina de estados, multi-LLM.',
    '["Python","LiteLLM","Pydantic","Tenacity","Rich","Pytest","Ruff","Mypy","Poetry"]',
    'https://github.com/Gabriel-Fachini/health-ai-assistant',
    '87 testes; suporte a múltiplos LLMs (OpenAI, Anthropic, Google, Ollama) sem mudança de código; validação de endereço real-time via ViaCEP/Google Maps',
    CURRENT_TIMESTAMP
  ),
  (
    (SELECT id FROM profile LIMIT 1),
    'Media Traffic AI Analyst',
    'Agente de analytics em linguagem natural para equipes de mídia e growth. Interpreta queries em português e executa SQL no BigQuery via tool calling estruturado.',
    '["Python","FastAPI","LangGraph","Claude (Anthropic)","GPT-4","BigQuery","Pydantic","Poetry"]',
    'https://github.com/Gabriel-Fachini/media-traffic-ai-analyst',
    'Roteador de intenção; normalização de datas em PT-BR; tool calling auditável (LLM nunca executa SQL direto); suporte multi-turno com contexto por thread',
    CURRENT_TIMESTAMP
  );
SQL
```

Verificar inserção:

```bash
sqlite3 ./job-tracker.db "SELECT name, stack FROM profileProjects;"
```
