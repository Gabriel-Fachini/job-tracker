import {
  BriefcaseBusiness,
  Building2,
  FileText,
  LayoutDashboard,
  UserRound,
  Waypoints,
  type LucideIcon,
} from "lucide-react";

export type AppNavigationItem = {
  href: string;
  label: string;
  summary: string;
  icon: LucideIcon;
  phase: string;
};

export const appNavigation: AppNavigationItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    summary: "Metricas, funil e diagnosticos do processo.",
    icon: LayoutDashboard,
    phase: "Fase 6",
  },
  {
    href: "/profile",
    label: "Perfil",
    summary: "Base estruturada do seu historico profissional.",
    icon: UserRound,
    phase: "Fase 2",
  },
  {
    href: "/companies",
    label: "Empresas",
    summary: "Mapa de empresas monitoradas e em processo.",
    icon: Building2,
    phase: "Fase 3",
  },
  {
    href: "/jobs",
    label: "Vagas",
    summary: "Registro local de oportunidades e descricoes.",
    icon: BriefcaseBusiness,
    phase: "Fase 3",
  },
  {
    href: "/applications",
    label: "Candidaturas",
    summary: "Board e timeline do processo seletivo.",
    icon: Waypoints,
    phase: "Fase 5",
  },
  {
    href: "/resumes",
    label: "Curriculos",
    summary: "Geracao e historico de PDFs personalizados.",
    icon: FileText,
    phase: "Fase 4",
  },
];
