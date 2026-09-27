import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Native <select> dressed like `SelectTrigger`. Use it inside uncontrolled
 * forms that rely on `required`, `form.reset()` and FormData, and where phones
 * should get the system picker. An empty-value option reads as a placeholder.
 */
function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div data-slot="native-select" className="relative min-w-0">
      <select
        className={cn(
          "peer h-8 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-input bg-field pr-8 pl-2.5 text-sm text-foreground transition-[border-color,box-shadow] duration-150 outline-none pointer-coarse:h-10 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/25 has-[option[value='']:checked]:text-subtle-foreground [&>option]:bg-popover [&>option]:text-popover-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-subtle-foreground peer-disabled:opacity-50"
      />
    </div>
  );
}

export { NativeSelect };
