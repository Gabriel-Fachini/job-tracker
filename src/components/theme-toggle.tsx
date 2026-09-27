"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { setThemePreference, useThemePreference } from "@/hooks/use-theme";
import type { ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: Array<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
  { value: "system", label: "Sistema", icon: Monitor },
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
];

/** Three-way theme picker. `showLabels` for settings rows; icons only in tight spots. */
export function ThemeToggle({
  showLabels = false,
  className,
}: {
  showLabels?: boolean;
  className?: string;
}) {
  const preference = useThemePreference();

  return (
    <SegmentedControl aria-label="Tema" className={className}>
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <SegmentedControlItem
          key={value}
          pressed={preference === value}
          onClick={() => setThemePreference(value)}
          aria-label={showLabels ? undefined : `Tema ${label.toLowerCase()}`}
          title={showLabels ? undefined : label}
          className={cn(!showLabels && "w-7 px-0 pointer-coarse:w-9")}
        >
          <Icon aria-hidden className="size-3.5" />
          {showLabels ? label : null}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

/** Single button that steps system → light → dark; for the collapsed sidebar. */
export function ThemeCycleButton({ className }: { className?: string }) {
  const preference = useThemePreference();
  const index = OPTIONS.findIndex((option) => option.value === preference);
  const current = OPTIONS[index] ?? OPTIONS[0];
  const next = OPTIONS[(index + 1) % OPTIONS.length];
  const Icon = current.icon;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => setThemePreference(next.value)}
      aria-label={`Tema: ${current.label.toLowerCase()}. Mudar para ${next.label.toLowerCase()}`}
      title={`Tema: ${current.label}`}
      className={cn("text-subtle-foreground hover:text-foreground", className)}
    >
      <Icon />
    </Button>
  );
}
