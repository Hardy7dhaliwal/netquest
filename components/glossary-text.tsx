"use client";

import { Fragment, useMemo } from "react";
import { tokenizeGlossaryText } from "@/lib/glossary";
import { useGlossary } from "@/components/glossary";

/**
 * Renders mission text with recognized glossary terms as clickable inline links
 * that open the glossary focused on that term. Backtick-delimited fragments are
 * styled as inline code (and never auto-linked), matching the app's CLI styling.
 */
export function GlossaryText({ text, className }: { text: string; className?: string }) {
  const { openGlossary } = useGlossary();
  const tokens = useMemo(() => tokenizeGlossaryText(text), [text]);

  return (
    <span className={className}>
      {tokens.map((token, index) => {
        if (token.type === "text") return <Fragment key={index}>{token.value}</Fragment>;
        if (token.type === "code") {
          return (
            <code className="rounded bg-slate-800/60 px-1 py-0.5 font-mono text-[0.9em] text-cyan-300" key={index}>
              {token.value}
            </code>
          );
        }
        return (
          <button
            className="mx-0.5 inline rounded-sm font-medium text-cyan-200 underline decoration-cyan-300/50 decoration-dotted underline-offset-2 transition hover:text-cyan-100 hover:decoration-solid focus:outline-none focus:ring-1 focus:ring-cyan-300/70"
            key={index}
            onClick={() => openGlossary(token.term)}
            title={`Look up ${token.term} in the glossary`}
            type="button"
          >
            {token.value}
          </button>
        );
      })}
    </span>
  );
}
