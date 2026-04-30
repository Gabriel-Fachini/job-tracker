"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type FormSubmitButtonProps = React.ComponentProps<typeof Button> & {
  pendingLabel: string;
};

export function FormSubmitButton({
  children,
  pendingLabel,
  disabled,
  type = "submit",
  ...props
}: FormSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type={type} disabled={disabled || pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
