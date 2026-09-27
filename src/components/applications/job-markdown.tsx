import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type JobMarkdownProps = {
  content: string | null | undefined;
  className?: string;
};

export function JobMarkdown({ content, className }: JobMarkdownProps) {
  const normalizedContent = normalizeMarkdown(content);

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ className, ...props }) => (
            <h1
              className={cn(
                "mb-3 text-lg leading-snug font-heading font-semibold tracking-tight text-balance text-foreground",
                className,
              )}
              {...props}
            />
          ),
          h2: ({ className, ...props }) => (
            <h2
              className={cn(
                "mt-6 mb-2 text-[15px] leading-snug font-heading font-semibold tracking-tight text-balance text-foreground first:mt-0",
                className,
              )}
              {...props}
            />
          ),
          h3: ({ className, ...props }) => (
            <h3
              className={cn(
                "mt-5 mb-2 text-sm leading-snug font-heading font-semibold text-foreground first:mt-0",
                className,
              )}
              {...props}
            />
          ),
          p: ({ className, ...props }) => (
            <p
              className={cn(
                "mb-3 text-[15px] leading-7 text-pretty text-muted-foreground last:mb-0 sm:text-sm sm:leading-6",
                className,
              )}
              {...props}
            />
          ),
          ul: ({ className, ...props }) => (
            <ul
              className={cn(
                "mb-3 list-disc pl-5 text-[15px] leading-7 text-muted-foreground marker:text-subtle-foreground sm:text-sm sm:leading-6",
                className,
              )}
              {...props}
            />
          ),
          ol: ({ className, ...props }) => (
            <ol
              className={cn(
                "mb-3 list-decimal pl-5 text-[15px] leading-7 text-muted-foreground marker:font-data marker:text-subtle-foreground sm:text-sm sm:leading-6",
                className,
              )}
              {...props}
            />
          ),
          li: ({ className, ...props }) => (
            <li className={cn("mt-1 pl-1", className)} {...props} />
          ),
          hr: ({ className, ...props }) => (
            <hr
              className={cn("my-6 border-border", className)}
              {...props}
            />
          ),
          a: ({ className, ...props }) => (
            <a
              className={cn(
                "break-all text-foreground underline underline-offset-4",
                className,
              )}
              {...props}
            />
          ),
          strong: ({ className, ...props }) => (
            <strong className={cn("font-semibold text-foreground", className)} {...props} />
          ),
          code: ({ className, ...props }) => (
            <code
              className={cn(
                "rounded bg-muted px-1 py-0.5 font-mono text-[0.88em] text-foreground",
                className,
              )}
              {...props}
            />
          ),
          pre: ({ className, ...props }) => (
            <pre
              className={cn(
                "mb-3 overflow-x-auto rounded-lg border border-border bg-canvas px-4 py-3 text-[13px]",
                className,
              )}
              {...props}
            />
          ),
          // Wide tables scroll inside their own box instead of widening the page.
          table: ({ className, ...props }) => (
            <div className="mb-3 max-w-full overflow-x-auto rounded-lg border border-border">
              <table className={cn("w-full text-sm", className)} {...props} />
            </div>
          ),
          th: ({ className, ...props }) => (
            <th
              className={cn(
                "border-b border-border bg-surface px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground",
                className,
              )}
              {...props}
            />
          ),
          td: ({ className, ...props }) => (
            <td
              className={cn("border-b border-border px-3 py-2 align-top text-muted-foreground", className)}
              {...props}
            />
          ),
          blockquote: ({ className, ...props }) => (
            <blockquote
              className={cn(
                "mb-3 border-l border-border-strong pl-4 text-subtle-foreground",
                className,
              )}
              {...props}
            />
          ),
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}

function normalizeMarkdown(content: string | null | undefined) {
  if (!content) {
    return "";
  }

  const withoutBom = content.replace(/^\uFEFF/, "");
  const normalizedNewlines = withoutBom.replace(/\r\n/g, "\n");
  const lines = normalizedNewlines.split("\n");
  const nonEmptyLines = lines.filter((line) => line.trim().length > 0);

  if (nonEmptyLines.length === 0) {
    return "";
  }

  const indentation = Math.min(
    ...nonEmptyLines
      .filter((line) => !line.startsWith("```"))
      .map((line) => {
        const match = line.match(/^(\s*)/);
        return match ? match[1].length : 0;
      }),
  );

  if (!Number.isFinite(indentation) || indentation === 0) {
    return normalizedNewlines.trim();
  }

  return lines
    .map((line) => line.slice(Math.min(indentation, line.length)))
    .join("\n")
    .trim();
}
