"use client";

import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

type CompanyLogoProps = {
  name: string;
  /** Null renders the monogram. */
  src: string | null;
  /** First lookup still running: keep the monogram until the image arrives. */
  pending?: boolean;
  fit?: "cover" | "contain";
  className?: string;
};

/**
 * 40px tile. Cached logos are rendered by the server and paint with the page;
 * a failed image falls back to the initials.
 */
export function CompanyLogo({
  name,
  src,
  pending = false,
  fit = "contain",
  className,
}: CompanyLogoProps) {
  // Keyed by src, so a new src starts over without resetting state by hand.
  const [outcome, setOutcome] = useState<{ src: string; loaded: boolean } | null>(null);
  const status = src && outcome?.src === src ? (outcome.loaded ? "loaded" : "failed") : "loading";
  const showImage = src !== null && status !== "failed";
  const isHidden = pending && status !== "loaded";

  // An image rendered on the server can finish (or fail) before hydration
  // attaches onLoad/onError; read the result off the element instead.
  const settleIfComplete = useCallback(
    (image: HTMLImageElement | null) => {
      if (image?.complete && src) {
        setOutcome({ src, loaded: image.naturalWidth > 0 });
      }
    },
    [src],
  );

  return (
    <span
      aria-hidden
      data-slot="company-logo"
      className={cn(
        "relative isolate flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface select-none",
        className,
      )}
    >
      {!showImage || isHidden ? (
        <span className="text-[13px] leading-none font-medium tracking-tight text-muted-foreground">
          {getInitials(name)}
        </span>
      ) : null}
      {showImage ? (
        // Plain <img>: favicons are ICO/SVG from our own route, which the
        // image optimizer can't take, and they are tiny already.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          ref={settleIfComplete}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setOutcome({ src, loaded: true })}
          onError={() => setOutcome({ src, loaded: false })}
          className={cn(
            "absolute inset-0 size-full bg-logo-tile transition-opacity duration-150 ease-(--ease-out-quart)",
            fit === "cover" ? "object-cover" : "object-contain p-1.5",
            isHidden && "opacity-0",
          )}
        />
      ) : null}
    </span>
  );
}

const CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e", "and", "of", "the", "&"]);

/** "Banco do Brasil" → "BB", "Nubank" → "N", "99" → "99". */
function getInitials(name: string) {
  const words = name
    .split(/[\s\-–_/.,]+/)
    .filter((word) => word && !CONNECTORS.has(word.toLocaleLowerCase("pt-BR")));

  if (words.length === 0) {
    return "?";
  }

  const [first, second] = words.map((word) => Array.from(word));

  if (!second) {
    return /\d/.test(first[0]) ? first.slice(0, 2).join("") : first[0].toLocaleUpperCase("pt-BR");
  }

  return `${first[0]}${second[0]}`.toLocaleUpperCase("pt-BR");
}
