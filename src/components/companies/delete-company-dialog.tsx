"use client";

import { useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getCompanyStatusLabel } from "@/lib/companies";
import { deleteCompany } from "@/server/actions/companies";

export type DeletableCompany = {
  id: number;
  name: string;
  status: string;
  applicationsCount: number;
  leadsCount: number;
  /** False while any job (and so any application) points at the company. */
  canDelete: boolean;
};

type DeleteCompanyDialogProps = {
  company: DeletableCompany;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Detail page: leave for the list instead of re-rendering a deleted company. */
  redirectToList?: boolean;
  /** Offered when deleting is blocked: changing the status is the way out. */
  onEdit?: () => void;
  finalFocus?: React.ComponentProps<typeof DialogContent>["finalFocus"];
};

export function DeleteCompanyDialog({
  company,
  open,
  onOpenChange,
  redirectToList = false,
  onEdit,
  finalFocus,
}: DeleteCompanyDialogProps) {
  const queryClient = useQueryClient();
  const [isDeleting, startDeleting] = useTransition();

  function handleDelete() {
    startDeleting(async () => {
      // With redirectToList the call rejects with Next's redirect, which the
      // router's redirect boundary turns into the navigation: don't catch it.
      const result = await deleteCompany(company.id, { redirectToList });

      if (result.ok) {
        onOpenChange(false);
        // Its leads are gone too; don't wait for the leads cache to go stale.
        void queryClient.invalidateQueries({ queryKey: ["leads"] });
        toast.success("Empresa excluída", { description: company.name });
        return;
      }

      toast.error(
        result.error === "linked-applications"
          ? "Esta empresa ganhou candidaturas e não pode mais ser excluída."
          : "Não foi possível excluir a empresa.",
      );
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isDeleting && onOpenChange(next)}>
      <DialogContent finalFocus={finalFocus} className="sm:max-w-md">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-balance break-words">
            {company.canDelete
              ? `Excluir ${company.name}?`
              : `${company.name} não pode ser excluída`}
          </DialogTitle>
          <DialogDescription className="text-pretty">
            {company.canDelete
              ? deletableDescription(company.leadsCount)
              : blockedDescription(company.applicationsCount, company.status)}
          </DialogDescription>
        </DialogHeader>

        {/* Phones: the two buttons side by side at the bottom of the sheet. */}
        <DialogFooter className="max-sm:mx-0 max-sm:mb-0 max-sm:grid max-sm:grid-cols-2 max-sm:border-t-0 max-sm:p-0 max-sm:pt-2 max-sm:[&>:only-child]:col-span-2">
          <DialogClose render={<Button type="button" variant="ghost" disabled={isDeleting} />}>
            {company.canDelete ? "Cancelar" : "Fechar"}
          </DialogClose>
          {company.canDelete ? (
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "Excluindo…" : "Excluir empresa"}
            </Button>
          ) : onEdit ? (
            <Button type="button" variant="outline" onClick={onEdit}>
              Mudar status
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function deletableDescription(leadsCount: number) {
  if (leadsCount === 0) {
    return "Ela sai da sua lista de empresas. Não dá para desfazer.";
  }

  const leads = leadsCount === 1 ? "o lead que o radar encontrou" : `os ${leadsCount} leads que o radar encontrou`;
  return `Ela sai da sua lista, junto com ${leads} nela. Não dá para desfazer.`;
}

function blockedDescription(applicationsCount: number, status: string) {
  const history =
    applicationsCount === 1
      ? "Uma candidatura guarda o histórico dela."
      : applicationsCount > 1
        ? `${applicationsCount} candidaturas guardam o histórico dela.`
        : "Há vagas salvas ligadas a ela.";

  if (status === "discarded" || status === "blacklist") {
    return `${history} Ela continua na lista como ${getCompanyStatusLabel(status)}.`;
  }

  return `${history} Se não quer mais acompanhá-la, mude o status para Descartada ou Blacklist.`;
}
