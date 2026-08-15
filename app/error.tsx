"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console or error reporting service
    console.error("NetQuest Runtime Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#030914] px-4 font-sans text-slate-100">
      <div className="w-full max-w-lg rounded-2xl border border-rose-900/40 bg-slate-950/90 p-8 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-950/60 text-rose-400 border border-rose-800/40">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              Simulator Runtime Exception
            </h2>
            <p className="text-xs text-rose-400 font-mono mt-0.5">
              An unexpected engine error occurred
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-slate-800/80 bg-slate-900/90 p-4 font-mono text-xs text-slate-300 overflow-x-auto">
          {error.message || "Unknown error encountered in mission runtime."}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={() => (window.location.href = "/")}
            className="rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
          >
            Dashboard
          </button>
          <button
            onClick={() => reset()}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-950/50 hover:bg-cyan-500 transition"
          >
            Re-initialize Simulator
          </button>
        </div>
      </div>
    </div>
  );
}
