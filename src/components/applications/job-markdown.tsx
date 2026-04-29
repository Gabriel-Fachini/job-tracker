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
                "mb-5 text-3xl leading-tight font-heading font-semibold tracking-tight text-foreground",
                className,
              )}
              {...props}
            />
          ),
          h2: ({ className, ...props }) => (
            <h2
              className={cn(
                "mt-8 mb-4 text-xl leading-tight font-heading font-semibold tracking-tight text-foreground",
                className,
              )}
              {...props}
            />
          ),
          h3: ({ className, ...props }) => (
            <h3
              className={cn(
                "mt-6 mb-3 text-lg leading-tight font-heading font-semibold tracking-tight text-foreground",
                className,
              )}
              {...props}
            />
          ),
          p: ({ className, ...props }) => (
            <p
              className={cn(
                "mb-4 text-sm leading-7 text-foreground last:mb-0",
                className,
              )}
              {...props}
            />
          ),
          ul: ({ className, ...props }) => (
            <ul
              className={cn(
                "mb-4 list-disc pl-6 text-sm leading-7 text-foreground marker:text-muted-foreground",
                className,
              )}
              {...props}
            />
          ),
          ol: ({ className, ...props }) => (
            <ol
              className={cn(
                "mb-4 list-decimal pl-6 text-sm leading-7 text-foreground marker:text-muted-foreground",
                className,
              )}
              {...props}
            />
          ),
          li: ({ className, ...props }) => (
            <li className={cn("mt-2 pl-1", className)} {...props} />
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
                "text-foreground underline underline-offset-4",
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
                "rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]",
                className,
              )}
              {...props}
            />
          ),
          pre: ({ className, ...props }) => (
            <pre
              className={cn(
                "mb-4 overflow-x-auto rounded-lg border border-border bg-background px-4 py-3 text-sm",
                className,
              )}
              {...props}
            />
          ),
          blockquote: ({ className, ...props }) => (
            <blockquote
              className={cn(
                "mb-4 border-l-2 border-border pl-4 text-muted-foreground",
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
