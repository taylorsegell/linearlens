import { useMemo } from "react";
import { markdownToHtml } from "../../../src/linear/markdown";

interface MarkdownContentProps {
  content?: string;
  className?: string;
  emptyLabel?: string;
  onOpenLink?: (url: string) => void;
}

export function MarkdownContent({
  content,
  className,
  emptyLabel = "No description",
  onOpenLink,
}: MarkdownContentProps) {
  const html = useMemo(() => markdownToHtml(content ?? ""), [content]);

  if (!content?.trim()) {
    return <p className="issue-detail-empty">{emptyLabel}</p>;
  }

  return (
    <div
      className={["issue-markdown", className].filter(Boolean).join(" ")}
      onClick={(event) => {
        const target = event.target;
        if (!(target instanceof HTMLAnchorElement) || !target.href) {
          return;
        }
        event.preventDefault();
        onOpenLink?.(target.href);
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
