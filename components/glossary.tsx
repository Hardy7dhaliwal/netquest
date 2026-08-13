"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GLOSSARY, GLOSSARY_CATEGORIES, type GlossaryCategory } from "@/lib/glossary";

/**
 * Lets any mission component open the glossary, optionally focused on one term
 * (e.g. from an inline glossary link). Provided by the <Glossary /> component
 * rendered in the root layout.
 */
export type GlossaryContextValue = {
  openGlossary: (term?: string) => void;
};

const GlossaryContext = createContext<GlossaryContextValue | null>(null);

export function useGlossary(): GlossaryContextValue {
  const value = useContext(GlossaryContext);
  if (!value) {
    throw new Error("useGlossary must be used inside <Glossary>, which is rendered by the root layout.");
  }
  return value;
}

const CATEGORY_STYLES: Record<GlossaryCategory, string> = {
  Switching: "border-cyan-300/30 bg-cyan-300/10 text-cyan-200",
  Routing: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  CLI: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  Concepts: "border-slate-400/40 bg-slate-400/10 text-slate-300",
  Tools: "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-200",
};

/** Renders `backtick` fragments as inline code, matching the app's CLI styling. */
function InlineCode({ text }: { text: string }) {
  const parts = text.split("`");
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <code className="rounded bg-slate-800/80 px-1 py-0.5 font-mono text-[0.9em] text-cyan-200" key={index}>
            {part}
          </code>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

/**
 * Renders the app content inside the glossary context and provides the floating
 * "Glossary" button plus searchable modal, available from every mission.
 * Rendered by the root layout wrapping `{children}`.
 */
export default function Glossary({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GlossaryCategory | "all">("all");
  // True when the query came from a "see also" chip — match the exact term only.
  const [exact, setExact] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (exact) return GLOSSARY.filter((entry) => entry.term.toLowerCase() === q);
    return GLOSSARY.filter((entry) => {
      if (category !== "all" && entry.category !== category) return false;
      if (!q) return true;
      return [entry.term, entry.definition, entry.detail ?? "", ...(entry.seeAlso ?? [])]
        .some((text) => text.toLowerCase().includes(q));
    });
  }, [query, category, exact]);

  const openGlossary = useCallback((term?: string) => {
    setQuery(term ?? "");
    setCategory("all");
    setExact(Boolean(term));
    setOpen(true);
  }, []);

  // While open: lock body scroll, close on Escape, trap Tab inside the dialog,
  // and focus the search box. On close, return focus to the trigger button.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key === "Tab" && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')
        ).filter((element) => !element.hasAttribute("disabled"));
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || active === panelRef.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(frame);
      buttonRef.current?.focus();
    };
  }, [open]);

  function jumpToTerm(term: string) {
    openGlossary(term);
    panelRef.current?.scrollTo({ top: 0 });
  }

  return (
    <GlossaryContext.Provider value={{ openGlossary }}>
      {children}
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-cyan-300/30 bg-slate-900/90 px-4 py-2.5 text-xs font-bold text-cyan-200 shadow-lg shadow-cyan-950/40 backdrop-blur transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-slate-800/90 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
        onClick={() => openGlossary()}
        ref={buttonRef}
        type="button"
      >
        <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 6.25c-1.75-1.4-4.1-2-6.5-1.9V18.5c2.4-.1 4.75.5 6.5 1.9 1.75-1.4 4.1-2 6.5-1.9V4.35c-2.4-.1-4.75.5-6.5 1.9Z" />
          <path d="M12 6.25v13.15" />
        </svg>
        Glossary
      </button>

      {open && (
        <div
          aria-labelledby="glossary-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm sm:p-6"
          onClick={() => setOpen(false)}
          role="dialog"
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl shadow-cyan-950/40"
            onClick={(event) => event.stopPropagation()}
            ref={panelRef}
          >
            <div className="border-b border-slate-800 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">Reference</p>
                  <h2 className="mt-1 text-xl font-black tracking-tight" id="glossary-title">Networking glossary</h2>
                </div>
                <button
                  aria-label="Close glossary"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition hover:border-slate-500 hover:text-white"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 focus-within:border-cyan-300/70">
                <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  id="glossary-search"
                  name="glossary-search"
                  aria-label="Search glossary"
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-600"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    if (exact) setExact(false);
                  }}
                  placeholder="Search VLAN, trunk, ping…"
                  ref={searchRef}
                  value={query}
                />
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{filtered.length}/{GLOSSARY.length} terms</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {(["all", ...GLOSSARY_CATEGORIES] as const).map((option) => (
                  <button
                    aria-pressed={category === option && !exact}
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition ${category === option && !exact ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"}`}
                    key={option}
                    onClick={() => {
                      setCategory(option);
                      setExact(false);
                    }}
                    type="button"
                  >
                    {option === "all" ? `All (${GLOSSARY.length})` : option}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
                  <p className="text-sm font-bold text-slate-300">No terms match “{query}”.</p>
                  <p className="mt-1 text-xs text-slate-500">Try a broader word, or clear the filters.</p>
                </div>
              ) : (
                filtered.map((entry) => (
                  <article className="rounded-xl border border-slate-800 bg-slate-950/60 p-4" key={entry.term}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-mono text-sm font-bold text-cyan-100">{entry.term}</h3>
                      <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${CATEGORY_STYLES[entry.category]}`}>{entry.category}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-300"><InlineCode text={entry.definition} /></p>
                    {entry.detail && <p className="mt-2 text-xs leading-5 text-slate-500"><InlineCode text={entry.detail} /></p>}
                    {entry.seeAlso && entry.seeAlso.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {entry.seeAlso.map((term) => (
                          <button
                            className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-400 transition hover:border-cyan-300/50 hover:text-cyan-200"
                            key={term}
                            onClick={() => jumpToTerm(term)}
                            type="button"
                          >
                            {term} →
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                ))
              )}
            </div>

            <div className="border-t border-slate-800 px-5 py-3 text-center text-[10px] uppercase tracking-widest text-slate-600">
              Press Esc to close
            </div>
          </div>
        </div>
      )}
    </GlossaryContext.Provider>
  );
}
