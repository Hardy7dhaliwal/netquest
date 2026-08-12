import { describe, expect, it } from "vitest";
import { resetCliBasicsMission, runCliBasicsCommand, startCliBasicsMission } from "./cli-basics-mission";

describe("Console Basics mission", () => {
  it("starts at the help step in user EXEC", () => {
    const state = startCliBasicsMission();
    expect(state.status).toBe("in_progress");
    expect(state.step).toBe("help");
    expect(state.cliMode).toBe("exec");
    expect(state.cliHistory).toEqual([]);
  });

  it("walks through all five steps to completion", () => {
    let state = startCliBasicsMission();

    state = runCliBasicsCommand(state, "help");
    expect(state.step).toBe("enable");
    expect(state.cliMode).toBe("exec");

    state = runCliBasicsCommand(state, "enable");
    expect(state.step).toBe("configure");
    expect(state.cliMode).toBe("privileged");

    state = runCliBasicsCommand(state, "configure terminal");
    expect(state.step).toBe("end");
    expect(state.cliMode).toBe("config");

    state = runCliBasicsCommand(state, "end");
    expect(state.step).toBe("show-version");
    expect(state.cliMode).toBe("privileged");

    state = runCliBasicsCommand(state, "show version");
    expect(state.status).toBe("complete");
    expect(state.step).toBe("complete");
    expect(state.eventLog.at(-1)?.tone).toBe("success");
    expect(state.cliHistory).toHaveLength(5);
  });

  it("ignores the wrong command for the current step without advancing", () => {
    const state = runCliBasicsCommand(startCliBasicsMission(), "enable");
    expect(state.step).toBe("help");
    expect(state.cliMode).toBe("privileged");
    expect(state.attempts).toBe(0);
  });

  it("treats unrecognized commands as a friendly hint, not an advance", () => {
    const state = runCliBasicsCommand(startCliBasicsMission(), "reboot");
    expect(state.step).toBe("help");
    expect(state.cliHistory[0].output).toContain("isn't recognized");
  });

  it("handles exit between modes without advancing steps", () => {
    let state = runCliBasicsCommand(startCliBasicsMission(), "help");
    state = runCliBasicsCommand(state, "enable");
    state = runCliBasicsCommand(state, "exit");
    expect(state.cliMode).toBe("exec");
    expect(state.step).toBe("configure");
  });

  it("does not change a completed mission", () => {
    let state = startCliBasicsMission();
    ["help", "enable", "configure terminal", "end", "show version"].forEach((command) => {
      state = runCliBasicsCommand(state, command);
    });
    expect(runCliBasicsCommand(state, "help")).toEqual(state);
    expect(resetCliBasicsMission().status).toBe("not_started");
  });
});
