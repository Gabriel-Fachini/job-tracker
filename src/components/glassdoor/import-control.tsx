"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import {
  importGlassdoorFile,
  type GlassdoorFileImportResult,
} from "@/server/actions/glassdoor";

/**
 * "Importar JSON do Glassdoor": picks a file from the collector skill and sends
 * it to the same import the token endpoint uses. Below `sm` only the icon shows.
 */
export function GlassdoorImportButton({
  onResult,
  variant = "outline",
  size = "default",
  compact = false,
}: {
  onResult: (result: GlassdoorFileImportResult) => void;
  /** Keep the label hidden until `xl`, for crowded page headers. */
  compact?: boolean;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      try {
        const result = await importGlassdoorFile(formData);
        onResult(result);

        if (result.ok) {
          router.refresh();
        }
      } catch {
        onResult({ ok: false, error: "Não foi possível enviar o arquivo." });
      } finally {
        // Lets the same file be picked again.
        input.value = "";
      }
    });
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleFile}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        aria-label="Importar JSON do Glassdoor"
        title="Importar JSON do Glassdoor"
      >
        <FileUp data-icon="inline-start" />
        <span className={compact ? "hidden xl:inline" : "hidden sm:inline"}>
          {pending ? "Importando…" : "Importar JSON do Glassdoor"}
        </span>
      </Button>
    </>
  );
}

export function GlassdoorImportNotice({
  result,
  className,
}: {
  result: GlassdoorFileImportResult | null;
  className?: string;
}) {
  if (!result) {
    return null;
  }

  if (!result.ok) {
    return (
      <Notice tone="negative" className={className}>
        {result.error}
      </Notice>
    );
  }

  return (
    <div className={className}>
      <ul className="flex flex-col gap-1.5">
        {result.companies.map((company) => (
          <li key={company.companyId}>
            <Notice tone="positive">
              <span className="font-medium text-foreground">{company.companyName}</span>
              {": "}
              {company.action === "created" ? "empresa criada" : "empresa atualizada"}
              {company.skippedDuplicateSnapshot ? " (coleta já importada)" : ""}
              {" · "}
              <span className="font-data">{company.newReviews}</span>{" "}
              {company.newReviews === 1 ? "avaliação nova" : "avaliações novas"} ·{" "}
              <span className="font-data">{company.newInterviews}</span>{" "}
              {company.newInterviews === 1 ? "entrevista nova" : "entrevistas novas"}
            </Notice>
          </li>
        ))}
        {result.errors.map((error, index) => (
          <li key={`error-${index}`}>
            <Notice tone="caution">
              Falha na coleta{error.glassdoorId ? ` (id ${error.glassdoorId})` : ""}: {error.error}
            </Notice>
          </li>
        ))}
      </ul>
    </div>
  );
}
