export type ResumeTemplateData = {
  fullName: string;
  headline?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  location?: string;
  summary?: string;

  experiences: Array<{
    company: string;
    role: string;
    startDate: string;
    endDate: string;
    location?: string;
    bullets: Array<{ content: string }>;
  }>;

  skills: Array<{
    category: string;
    items: string;
  }>;

  languages?: Array<{
    name: string;
    level: string;
  }>;

  projects: Array<{
    name: string;
    url?: string;
    stack?: string;
    description?: string;
    impact?: string;
  }>;

  education: Array<{
    institution: string;
    degree?: string;
    field?: string;
    period?: string;
    location?: string;
  }>;
};
