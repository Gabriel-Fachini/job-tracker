import { ModulePlaceholder } from "@/components/module-placeholder";

export default function JobsPage() {
  return (
    <ModulePlaceholder
      href="/jobs"
      eyebrow="Fase 3"
      title="Vagas"
      description="A navegacao ja contempla o registro manual e a captura futura pela extensao. Falta agora plugar extracao com Ollama, persistencia e a exibicao da descricao completa."
    />
  );
}
