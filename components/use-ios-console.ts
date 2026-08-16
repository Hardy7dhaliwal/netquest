"use client";

/**
 * IOS-like console input behavior for the terminal components: ↑/↓ recall of
 * previously run commands (like a real device's CLI history buffer) and Tab
 * completion against the parent's command list for the current step.
 *
 * History is per console-session: every submitted command is remembered,
 * ArrowUp walks back through it, ArrowDown walks forward again (clearing the
 * buffer when it passes the newest entry). Tab completes the last word via
 * `iosTabComplete` — ambiguous abbreviations are left alone, exactly like
 * IOS's "Ambiguous command".
 */

import { useCallback, useState } from "react";
import type { KeyboardEvent } from "react";
import { iosTabComplete } from "@/lib/ios-console";

export function useIosConsole({
  onRun,
  completions,
}: {
  onRun: (command: string) => void;
  /** Full commands the current step accepts; drives Tab completion. */
  completions?: string[];
}) {
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);

  const submit = useCallback(() => {
    const value = command.trim();
    if (!value) return;
    onRun(value);
    setHistory((previous) => (previous[previous.length - 1] === value ? previous : [...previous, value]));
    setCommand("");
    setHistoryIndex(null);
  }, [command, onRun]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (history.length === 0) return;
      const index = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(index);
      setCommand(history[index]);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (historyIndex === null) return;
      const index = historyIndex + 1;
      if (index >= history.length) {
        setHistoryIndex(null);
        setCommand("");
      } else {
        setHistoryIndex(index);
        setCommand(history[index]);
      }
    } else if (event.key === "Tab") {
      event.preventDefault();
      setCommand((current) => iosTabComplete(current, completions ?? []));
    }
  }

  return { command, setCommand, submit, handleKeyDown };
}