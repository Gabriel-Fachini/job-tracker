import {
  Building2,
  LayoutDashboard,
  Radar,
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
    href: "/applications",
    label: "Candidaturas",
    summary: "Board e timeline do processo seletivo.",
    icon: Waypoints,
    phase: "Fase 5",
  },
  {
    href: "/leads",
    label: "Leads",
    summary: "Triagem das vagas monitoradas antes da candidatura.",
    icon: Radar,
    phase: "Fase 5A",
  },
];
