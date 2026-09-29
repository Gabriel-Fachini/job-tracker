"use client";

import { Button } from "@/components/ui/button";
import { userDiscardReasonOptions, type UserDiscardReason } from "@/lib/job-monitoring/triage/discard-reasons";

type DiscardReasonChipsProps = {
  disabled?: boolean;
  /** `null` = discard without saying why. */
  onPick: (reason: UserDiscardReason | null) => void;
  onCancel: () => void;
};

/**
 * Optional "why" for a manual discard. Each chip discards right away with that
 * reason; the reason feeds the classifier's recent feedback and the dashboard.
 */
export function DiscardReasonChips({ disabled, onPick, onCancel }: DiscardReasonChipsProps) {
  return (
    <div role="group" aria-label="Motivo do descarte (opcional)" className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">Motivo do descarte (opcional)</p>
      <div className="flex flex-wrap gap-1.5">
        {userDiscardReasonOptions.map((option) => (
          <Button
            disabled={disabled}
            key={option.value}
            onClick={() => onPick(option.value)}
            size="xs"
            type="button"
            variant="outline"
          >
            {option.label}
          </Button>
        ))}
        <Button disabled={disabled} onClick={() => onPick(null)} size="xs" type="button" variant="ghost">
          Sem motivo
        </Button>
        <Button disabled={disabled} onClick={onCancel} size="xs" type="button" variant="ghost">
          Cancelar
        </Button>
      </div>
    </div>
  );
}
