import type { ResumeTemplateData } from '../types';

function getSampleProfileEnv(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

export const sampleProfile: ResumeTemplateData = {
  fullName: getSampleProfileEnv('SAMPLE_PROFILE_FULL_NAME', 'Alex Silva'),
  email: getSampleProfileEnv('SAMPLE_PROFILE_EMAIL', 'alex.silva@example.com'),
  phone: getSampleProfileEnv('SAMPLE_PROFILE_PHONE', '+55 11 99999-9999'),
  linkedin: getSampleProfileEnv(
    'SAMPLE_PROFILE_LINKEDIN',
    'https://linkedin.com/in/alex-silva',
  ),
  github: getSampleProfileEnv(
    'SAMPLE_PROFILE_GITHUB',
    'https://github.com/alex-silva',
  ),
  location: getSampleProfileEnv('SAMPLE_PROFILE_LOCATION', 'Brasil'),

  experiences: [
    {
      company: 'Cubbo Logistics',
      role: 'Engenheiro de Software Global',
      startDate: '06/2025',
      endDate: '09/2025',
      location: 'Remoto - Brasil',
      bullets: [
        {
          content:
            'Atuei em uma equipe internacional de engenharia, com comunicação em inglês, desenvolvendo e mantendo sistemas logísticos para operações de fulfillment no Brasil e no México.',
        },
        {
          content:
            'Traduzi a interface do Handheld App para português, cobrindo cerca de 6 telas e 10 componentes, o que viabilizou o uso da aplicação por operadores do novo centro de distribuição em Porto Alegre e apoiou a melhoria da operação local.',
        },
        {
          content:
            'Desenvolvi o frontend de uma página dedicada ao recebimento de produtos da Natura, principal cliente da empresa, implementando layouts, formulários, validações complexas e componentes React reutilizáveis para um fluxo com cerca de 50 campos e 12 regras fiscais.',
        },
        {
          content:
            'Modelei a base de dados e implementei as telas principais de um Dashboard Analytics integrado à Shopify, estruturando os fluxos iniciais do produto e um esquema com 14 tabelas para sustentar futuras automações e insights de loja.',
        },
        {
          content:
            'Atuei como bugmaster em períodos entre projetos, resolvendo incidentes em produção, investigando logs e corrigindo falhas operacionais críticas relacionadas a pedidos, faturamento e integrações.',
        },
        {
          content:
            'Otimizei uma query SQL crítica para obtenção de pedidos pendentes por meio da criação de índice na tabela shipping_labels, reduzindo em 50% o tempo de execução.',
        },
      ],
    },
    {
      company: 'Toro Investimentos',
      role: 'Engenheiro de Software Fullstack',
      startDate: '01/2022',
      endDate: '06/2025',
      location: 'Remoto - Brasil',
      bullets: [
        {
          content:
            'Atuei como único desenvolvedor responsável pelo Valorize, evoluindo uma solução interna de engajamento de um MVP para uma plataforma mais robusta utilizada por cerca de 700 colaboradores.',
        },
        {
          content:
            'Participei de todo o ciclo de produto, incluindo definição de metas, priorização, decisões técnicas, design, implementação, testes, validação e suporte aos usuários.',
        },
        {
          content:
            'Desenvolvi funcionalidades de gamificação, biblioteca virtual e incentivos educacionais que contribuíram para aumentar o engajamento semanal da plataforma de 12% para 37%.',
        },
        {
          content:
            'Implementei sozinho o pipeline de CI/CD no Azure DevOps, reduzindo o tempo de deploy de 24 para 9 minutos, reduzindo erros manuais e permitindo múltiplas liberações diárias.',
        },
        {
          content:
            'Desenvolvi integrações via GraphQL e REST com plataformas do ecossistema de people para incorporar dados de feedback, avaliações de desempenho e 1:1s às regras de gamificação do produto.',
        },
        {
          content:
            'Criei bots, scripts e rotinas agendadas para Slack e para a própria plataforma, automatizando tarefas operacionais recorrentes do time e fluxos internos do produto.',
        },
        {
          content:
            'Desenvolvi e coloquei em produção um assistente com LLM + RAG integrado ao Slack para responder dúvidas recorrentes dos usuários sobre o funcionamento da plataforma.',
        },
        {
          content:
            'Trabalhei com TypeScript, React, Node.js, Serverless Functions, SQL Server, Python e Azure DevOps na evolução contínua da plataforma.',
        },
      ],
    },
  ],

  skills: [
    { category: 'Linguagens', items: 'TypeScript, JavaScript, Python, Ruby, SQL' },
    { category: 'Frontend', items: 'React, React Native, HTML, CSS, Tailwind CSS, Material UI, Storybook' },
    { category: 'Backend', items: 'Node.js, Express, Ruby on Rails, REST APIs, GraphQL, Serverless Functions' },
    { category: 'Banco de dados', items: 'SQL Server, PostgreSQL, MongoDB, Redis' },
    { category: 'Cloud & DevOps', items: 'Azure DevOps, AWS, Docker, CI/CD, Serverless Framework' },
    { category: 'Testes & Ferramentas', items: 'Git, GitHub, Jest, Vitest, Postman, Figma' },
    {
      category: 'IA & Automação',
      items: 'LLM Integration, RAG, AI Agents, Embeddings, Semantic Search, LangChain, LangGraph, MCP',
    },
  ],

  languages: [
    { name: 'Português', level: 'Nativo' },
    { name: 'Inglês', level: 'Avançado' },
  ],

  projects: [],

  education: [
    {
      institution: 'Universidade de São Paulo (USP)',
      degree: 'Bacharelado',
      field: 'Sistemas de Informação',
      period: 'Previsão de conclusão: dez/2026',
      location: 'Brasil',
    },
  ],
};
