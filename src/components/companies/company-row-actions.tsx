"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Ellipsis, PencilLine, Trash2 } from "lucide-react";

import type { CompanyFormValues } from "@/components/companies/company-form";
import { CompanyLogo } from "@/components/companies/company-logo";
import {
  DeleteCompanyDialog,
  type DeletableCompany,
} from "@/components/companies/delete-company-dialog";
import { EditCompanySheet } from "@/components/companies/edit-company-sheet";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { CompanyLogoView } from "@/lib/company-logos";
import { cn } from "@/lib/utils";

type CompanyRowActionsProps = {
  company: DeletableCompany & {
    website: string | null;
    logo: CompanyLogoView;
  };
  values: CompanyFormValues;
  className?: string;
};

/**
 * Edit and delete for one row. From `sm` they are icon buttons; phones get one
 * "more" button that opens a bottom sheet with bigger targets.
 */
export function CompanyRowActions({ company, values, className }: CompanyRowActionsProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // The edit sheet and delete dialog have no trigger of their own: focus goes
  // back to whatever opened them.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  // Set when the menu closes because it handed over to the sheet or dialog.
  const handedOffRef = useRef(false);

  function openFromMenu(openLayer: (open: boolean) => void) {
    handedOffRef.current = true;
    setMenuOpen(false);
    openLayer(true);
  }

  return (
    <div className={cn("relative z-10 flex items-center", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Ações para ${company.name}`}
        className="-mr-1.5 text-subtle-foreground sm:hidden"
        onClick={(event) => {
          returnFocusRef.current = event.currentTarget;
          handedOffRef.current = false;
          setMenuOpen(true);
        }}
      >
        <Ellipsis />
      </Button>

      <div className="-mr-1.5 hidden items-center gap-0.5 sm:flex">
        <RowIconButton
          label="Editar"
          name={company.name}
          onClick={(event) => {
            returnFocusRef.current = event.currentTarget;
            setEditOpen(true);
          }}
        >
          <PencilLine />
        </RowIconButton>
        <RowIconButton
          label="Excluir"
          name={company.name}
          destructive
          onClick={(event) => {
            returnFocusRef.current = event.currentTarget;
            setDeleteOpen(true);
          }}
        >
          <Trash2 />
        </RowIconButton>
      </div>

      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent
          showCloseButton={false}
          finalFocus={() => !handedOffRef.current}
          className="gap-0 px-2 pt-6 sm:max-w-sm sm:p-2"
        >
          <DialogHeader className="flex-row items-center gap-3 border-b border-border px-2 pb-3 sm:pt-1">
            <CompanyLogo name={company.name} {...company.logo} />
            <div className="min-w-0">
              <DialogTitle className="truncate text-[15px] font-medium">{company.name}</DialogTitle>
              <DialogDescription className="truncate text-[13px]">
                {company.website ? readableUrl(company.website) : "Sem site registrado"}
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="flex flex-col py-1.5">
            <Link
              href={`/companies/${company.id}`}
              className={sheetItemClassName}
              onClick={() => setMenuOpen(false)}
            >
              <ArrowRight aria-hidden />
              Ver detalhes
            </Link>
            <button
              type="button"
              className={sheetItemClassName}
              onClick={() => openFromMenu(setEditOpen)}
            >
              <PencilLine aria-hidden />
              Editar
            </button>
            {company.website ? (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className={sheetItemClassName}
                onClick={() => setMenuOpen(false)}
              >
                <ArrowUpRight aria-hidden />
                Abrir site
              </a>
            ) : null}
            <div aria-hidden className="mx-3 my-1.5 h-px bg-border" />
            <button
              type="button"
              className={cn(sheetItemClassName, "text-destructive [&_svg]:text-destructive")}
              onClick={() => openFromMenu(setDeleteOpen)}
            >
              <Trash2 aria-hidden />
              Excluir
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <EditCompanySheet
        company={company}
        values={values}
        logo={company.logo}
        open={editOpen}
        onOpenChange={setEditOpen}
        finalFocus={() => returnFocusRef.current}
      />

      <DeleteCompanyDialog
        company={company}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        finalFocus={() => returnFocusRef.current}
        onEdit={() => {
          setDeleteOpen(false);
          setEditOpen(true);
        }}
      />
    </div>
  );
}

const sheetItemClassName =
  "flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-[15px] font-medium text-foreground outline-none transition-colors duration-150 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:bg-accent [&_svg]:size-[18px] [&_svg]:shrink-0 [&_svg]:text-subtle-foreground";

function RowIconButton({
  label,
  name,
  destructive = false,
  onClick,
  children,
}: {
  label: string;
  name: string;
  destructive?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`${label} ${name}`}
            onClick={onClick}
            className={cn(
              "text-subtle-foreground",
              destructive && "hover:bg-destructive/12 hover:text-destructive",
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function readableUrl(value: string) {
  return value.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}
