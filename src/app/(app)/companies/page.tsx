import { ModulePlaceholder } from "@/components/module-placeholder";

export default function CompaniesPage() {
  return (
    <ModulePlaceholder
      href="/companies"
      eyebrow="Fase 3"
      title="Empresas"
      description="O modulo de empresas ja tem rota dedicada dentro da arvore planejada. A listagem, os formularios e os detalhes entram aqui quando o CRUD for implementado."
    />
  );
}
