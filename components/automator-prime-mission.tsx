"use client";
import { Wordmark } from "@/components/wordmark";

import {
  AUTOMATOR_PHASES as PHASES,
  automatorPromptFor,
  chooseAgent,
  chooseApis,
  chooseRest,
  chooseYang,
  runAutomatorCommand,
  type AutomatorAgentOption,
  type AutomatorApisOption,
  type AutomatorPrimeMissionState,
  type AutomatorRestOption,
  type AutomatorYangOption,
} from "@/lib/automator-prime-mission";
import { HintLadder } from "@/components/hint-ladder";
import { CommandReference } from "@/components/command-reference";
import { ConsolePanel } from "@/components/console-panel";
import { GlossaryText } from "@/components/glossary-text";

const phaseCopy = {
  python: {
    label: "Python · code · 6.1",
    title: "Script the probe",
    prompt: "On the automation workstation, write the Python probe that reads the device's interfaces over RESTCONF — import the HTTP client, send the GET with basic auth, then read the first interface name.",
  },
  json: {
    label: "JSON · code · 6.2",
    title: "Craft the payload",
    prompt: "Construct two valid JSON documents: the RESTCONF body that creates Loopback100 in the ietf-interfaces data store, and the SD-WAN Manager payload that registers device BR-1.",
  },
  yang: {
    label: "YANG · interpret · 6.3",
    title: "The data model",
    prompt: "Why did the payload need ietf-interfaces:interfaces exactly? Pick the statement that correctly describes YANG data modeling.",
  },
  apis: {
    label: "APIs · inspect · 6.4",
    title: "Call the controllers",
    prompt: "The probe now targets the controllers. The SD-WAN Manager (formerly vManage) call uses GET https://vmanage.example.com/dataservice/device with an X-XSRF-TOKEN header. Which statement about the controllers' APIs is correct?",
  },
  rest: {
    label: "Responses · interpret · 6.5",
    title: "Read the reply",
    prompt: "The PUT that created Loopback100 returned 201 Created. What does that status code mean?",
  },
  eem: {
    label: "EEM applet · code · 6.6",
    title: "Automate on the box",
    prompt: "No controller can save the config for you. On R-CORE, build an EEM applet that saves the running config every time a config change (CONFIG_I) hits the syslog — then verify it.",
  },
  agent: {
    label: "Orchestration · interpret · 6.7",
    title: "Agent or not?",
    prompt: "The fleet is about to be orchestrated at scale. Which statement correctly contrasts agent and agentless orchestration tools?",
  },
} as const;

const yangChoices: AutomatorYangOption[] = ["data-model-tree", "scripting-language", "yaml-cli"];
const apisChoices: AutomatorApisOption[] = ["rest-xsrf", "soap-xml", "snmp-get"];
const restChoices: AutomatorRestOption[] = ["created", "not-found", "server-error"];
const agentChoices: AutomatorAgentOption[] = ["agentless-ssh", "agentless-install", "agent-no-software"];

const optionCopy = {
  "data-model-tree": { title: "Models data as a tree of containers, lists, leaves", note: "The schema your JSON is validated against" },
  "scripting-language": { title: "A scripting language for devices", note: "YANG describes data, it never executes" },
  "yaml-cli": { title: "A YAML-based CLI format", note: "YANG is encoding-independent — JSON/XML both work" },
  "rest-xsrf": { title: "REST APIs, JSON over HTTPS", note: "/dataservice/ on SD-WAN Manager + X-XSRF-TOKEN" },
  "soap-xml": { title: "SOAP web services with XML envelopes", note: "The controllers are REST, not SOAP" },
  "snmp-get": { title: "The device SNMP-pushes traps to the script", note: "Your script calls the controller, not the reverse" },
  created: { title: "201 — the resource was created", note: "The PUT succeeded and Loopback100 now exists" },
  "not-found": { title: "404 — the resource is missing", note: "The call succeeded — it created something" },
  "server-error": { title: "500 — the server failed", note: "That is a server-side fault, not a create" },
  "agentless-ssh": { title: "Agentless = SSH/WinRM, nothing installed", note: "Ansible-style: drive devices directly" },
  "agentless-install": { title: "Agentless = software on every device", note: "Installing software is the agent model" },
  "agent-no-software": { title: "Agent-based = nothing on the target", note: "An agent IS the software on the target" },
} as const;

const PYTHON_COMMANDS = [
  { command: "import requests", description: "Load the HTTP client library.", mode: "Python REPL" },
  { command: `r = requests.get("https://198.51.100.10/restconf/data/interfaces", auth=("admin", "C1scoBranch!"), verify=False)`, description: "GET the interfaces over RESTCONF with basic auth.", mode: "Python REPL" },
  { command: `print(r.status_code, r.json()["ietf-interfaces:interfaces"]["interface"][0]["name"])`, description: "Read the status code and the first interface name.", mode: "Python REPL" },
];

const JSON_COMMANDS = [
  { command: `{"ietf-interfaces:interfaces": {"interface": [{"name": "Loopback100", "type": "ianaift:softwareLoopback", "enabled": true}]}}`, description: "Valid JSON — RESTCONF PUT body creating Loopback100.", mode: "JSON" },
  { command: `{"name": "BR-1", "description": "branch router", "siteId": "site-42", "deviceType": "vedge-cloud"}`, description: "Valid JSON — SD-WAN Manager device payload for BR-1.", mode: "JSON" },
];

const EEM_COMMANDS = [
  { command: "enable", description: "Enter privileged EXEC on R-CORE.", mode: "user EXEC" },
  { command: "configure terminal", description: "Enter global configuration mode.", mode: "privileged" },
  { command: "event manager applet save-config", description: "Define the EEM applet.", mode: "config" },
  { command: `event syslog pattern "CONFIG_I"`, description: "Trigger on config-change syslog messages.", mode: "config" },
  { command: `action 1.0 cli command "enable"`, description: "Enter privileged mode when it fires.", mode: "config" },
  { command: `action 2.0 cli command "write memory"`, description: "Save the running configuration.", mode: "config" },
  { command: "end", description: "Return to privileged EXEC.", mode: "config" },
  { command: "show running-config | include event manager applet", description: "Verify the applet is configured.", mode: "privileged" },
];

const phaseHints: Record<string, string[]> = {
  python: [
    "Start by importing the HTTP client: import requests.",
    "Then send the GET to /restconf/data/interfaces with auth=(\"admin\", \"C1scoBranch!\") and verify=False.",
    "Finish with the print(...) that reads r.status_code and the first interface name.",
  ],
  json: [
    "The first document wraps an interface in ietf-interfaces:interfaces.",
    "The interface list has name, type (ianaift:softwareLoopback), and enabled.",
    "The second document registers device BR-1 for SD-WAN Manager: name, description, siteId, deviceType.",
  ],
  yang: [
    "YANG is a data modeling language — it describes the SHAPE of data.",
    "Modules contain containers, lists, and leaves in a tree.",
    "Choose the data-modeling-tree statement.",
  ],
  apis: [
    "Cisco Catalyst Center (formerly DNA Center) and SD-WAN Manager (formerly vManage) are REST APIs over HTTPS, exchanging JSON.",
    "SD-WAN Manager endpoints start with /dataservice/ and need the X-XSRF-TOKEN header.",
    "Choose the REST + JSON statement.",
  ],
  rest: [
    "2xx means success; 4xx means your request was wrong; 5xx means the server failed.",
    "A PUT that creates a resource returns 201 Created.",
    "Choose the 201 statement.",
  ],
  eem: [
    "On R-CORE: enable, then configure terminal.",
    "event manager applet save-config, then its event syslog pattern and two cli actions.",
    "Verify from privileged EXEC: show running-config | include event manager applet.",
  ],
  agent: [
    "Agentless tools connect over SSH/WinRM — nothing is installed on the target.",
    "Agent-based tools install software (the agent) on every managed device.",
    "Choose the SSH/nothing-installed statement.",
  ],
};

const phaseLabels = ["Python", "JSON", "YANG", "APIs", "Responses", "EEM", "Agent"];

export default function AutomatorPrimeMission({
  mission,
  onChange,
  onExit,
}: {
  mission: AutomatorPrimeMissionState;
  onChange: (next: AutomatorPrimeMissionState) => void;
  onExit: () => void;
}) {
  const complete = mission.status === "complete";
  const activePhase = mission.phase === "complete" ? "agent" : mission.phase;
  const phaseIndex = complete ? PHASES.length : PHASES.indexOf(activePhase);
  const copy = complete ? phaseCopy.agent : phaseCopy[activePhase];
  const consolePhase = mission.phase === "python" || mission.phase === "json" || mission.phase === "eem";
  const workspaceDevice = mission.phase === "eem" ? "R-CORE" : "WORKSTATION";

  function choose(option: AutomatorYangOption | AutomatorApisOption | AutomatorRestOption | AutomatorAgentOption) {
    if (mission.phase === "yang") onChange(chooseYang(mission, option as AutomatorYangOption));
    else if (mission.phase === "apis") onChange(chooseApis(mission, option as AutomatorApisOption));
    else if (mission.phase === "rest") onChange(chooseRest(mission, option as AutomatorRestOption));
    else onChange(chooseAgent(mission, option as AutomatorAgentOption));
  }

  const choices: AutomatorYangOption[] | AutomatorApisOption[] | AutomatorRestOption[] | AutomatorAgentOption[] =
    mission.phase === "yang"
      ? yangChoices
      : mission.phase === "apis"
        ? apisChoices
        : mission.phase === "rest"
          ? restChoices
          : agentChoices;

  const emptyText =
    mission.phase === "python" ? (
      <>
        On the <span className="text-slate-400">WORKSTATION</span> (prompt <span className="text-slate-400">&gt;&gt;&gt;</span>): <span className="text-slate-400">import requests</span>, then the <span className="text-slate-400">requests.get("https://198.51.100.10/restconf/data/interfaces", auth=("admin", "C1scoBranch!"), verify=False)</span> call, then the <span className="text-slate-400">print(r.status_code, r.json()["ietf-interfaces:interfaces"]["interface"][0]["name"])</span> read.
      </>
    ) : mission.phase === "json" ? (
      <>
        On the <span className="text-slate-400">WORKSTATION</span> (prompt <span className="text-slate-400">json&gt; </span>): type the ietf-interfaces envelope <span className="text-slate-400">{"{\"ietf-interfaces:interfaces\": {\"interface\": [{\"name\": \"Loopback100\", \"type\": \"ianaift:softwareLoopback\", \"enabled\": true}]}}"}</span>, then the SD-WAN Manager payload <span className="text-slate-400">{"{\"name\": \"BR-1\", \"description\": \"branch router\", \"siteId\": \"site-42\", \"deviceType\": \"vedge-cloud\"}"}</span>.
      </>
    ) : (
      <>
        On <span className="text-slate-400">R-CORE</span>: <span className="text-slate-400">enable</span> → <span className="text-slate-400">configure terminal</span>, then <span className="text-slate-400">event manager applet save-config</span> with its <span className="text-slate-400">event syslog pattern</span> and two <span className="text-slate-400">action ... cli command</span> lines, then verify with <span className="text-slate-400">show running-config | include event manager applet</span>.
      </>
    );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800/80 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div>
            <Wordmark onHome={onExit} track="Automation + AI" />
            <h1 className="mt-2 text-xl font-bold">Automator Prime</h1>
          </div>
          <button className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white" onClick={onExit} type="button">Back to dashboard</button>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-5 p-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:p-8">
        <aside className="space-y-5">
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Incident brief</p>
            <h2 className="mt-3 text-xl font-bold">The network is going automated.</h2>
            <p className="mt-3 text-sm leading-6 text-slate-400"><GlossaryText text="The operations team scripts everything now. You write the Python probe that reads devices over RESTCONF, construct the JSON payloads the controllers accept, understand the YANG model behind them, call the SD-WAN Manager API, read the response codes, build the EEM applet that saves configs on change — then choose how to orchestrate the whole fleet." /></p>
          </section>
          <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Mission progress</p>
              <span className="text-xs text-slate-500">{phaseIndex}/{PHASES.length}</span>
            </div>
            <div className="mt-4 space-y-3">
              {PHASES.map((phase, index) => (
                <div className="flex items-start gap-3 text-sm" key={phase}>
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${index < phaseIndex ? "border-emerald-300 bg-emerald-300 text-slate-950" : "border-slate-600 text-transparent"}`}>✓</span>
                  <span className={index < phaseIndex ? "text-slate-200" : "text-slate-500"}>{phaseLabels[index]}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-xl border border-amber-300/20 bg-amber-300/5 p-5 text-xs leading-5 text-slate-400">
            <p className="font-bold uppercase tracking-[0.2em] text-amber-200">Field note</p>
            <p className="mt-3"><GlossaryText text="Automation &amp; AI: Python scripts drive RESTCONF/REST APIs (requests + basic auth — verify=False is a lab shortcut; production points verify at a trusted CA bundle). JSON is the payload format; YANG is the data model behind it (containers/lists/leaves). Cisco Catalyst Center and SD-WAN Manager expose REST APIs (SD-WAN Manager: /dataservice/ + X-XSRF-TOKEN). Read status codes: 2xx success, 4xx bad request, 5xx server fault. EEM applets run on the box: event syslog pattern + action cli command. Agentless = SSH/WinRM with nothing installed; agent = software on each device." /></p>
          </section>
          <HintLadder hints={complete ? [] : phaseHints[mission.phase] ?? []} resetKey={mission.phase} />
        </aside>

        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">{complete ? "Mission complete" : copy.label}</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight">{complete ? "The fleet runs itself." : copy.title}</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400"><GlossaryText text={complete ? "You scripted the probe, crafted the JSON, decoded the YANG model, called the SD-WAN Manager API, read the responses, built the on-box EEM applet — and chose how to orchestrate the fleet." : copy.prompt} /></p>
            </div>
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs font-bold text-cyan-200">{mission.attempts} attempt{mission.attempts === 1 ? "" : "s"}</span>
          </div>

          {consolePhase && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-slate-700 px-3 py-1 text-xs font-bold text-slate-400">Console attached to {workspaceDevice}</span>
              </div>
              <ConsolePanel
                key={mission.phase}
                deviceName={workspaceDevice}
                prompt={automatorPromptFor(mission.phase, mission.cliMode)}
                history={mission.cliHistory}
                onRun={(command) => onChange(runAutomatorCommand(mission, command))}
                inputId="automator-prime-cli"
                emptyText={emptyText}
              />
              <CommandReference
                commands={mission.phase === "python" ? PYTHON_COMMANDS : mission.phase === "json" ? JSON_COMMANDS : EEM_COMMANDS}
                title={mission.phase === "python" ? "Python probe commands" : mission.phase === "json" ? "JSON payloads" : "EEM applet commands"}
              />
            </div>
          )}

          {(mission.phase === "yang" || mission.phase === "apis" || mission.phase === "rest" || mission.phase === "agent") && (
            <div aria-label={`Choose ${copy.label}`} className="mt-8 grid gap-4 md:grid-cols-3" role="group">
              {choices.map((option) => {
                const selected =
                  mission.phase === "yang"
                    ? mission.selectedYang === option
                    : mission.phase === "apis"
                      ? mission.selectedApis === option
                      : mission.phase === "rest"
                        ? mission.selectedRest === option
                        : mission.selectedAgent === option;
                return (
                  <button aria-pressed={selected} className={`rounded-xl border p-5 text-left transition hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 ${selected ? "border-cyan-300/60 bg-cyan-300/10" : "border-slate-700 bg-slate-950/70 hover:border-cyan-300/50"}`} key={option} onClick={() => choose(option)} type="button">
                    <p className="text-sm font-bold">{optionCopy[option].title}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{optionCopy[option].note}</p>
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/80 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Event log</p>
            <div className="mt-4 space-y-3" aria-live="polite">
              {mission.eventLog.map((entry, index) => <div className="flex gap-3 text-sm" key={`${entry.message}-${index}`}><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${entry.tone === "success" ? "bg-emerald-300" : entry.tone === "error" ? "bg-rose-300" : "bg-cyan-300"}`} /><span className={entry.tone === "success" ? "text-emerald-200" : entry.tone === "error" ? "text-rose-200" : "text-slate-400"}>{entry.message}</span></div>)}
            </div>
          </div>

          {complete && <div className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-300/10 p-5 text-center"><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Objectives 6.1–6.7 checkpoint · final mission</p><p className="mt-2 text-xl font-black">Python · JSON · YANG · APIs · Responses · EEM · Orchestration · +200 XP</p><p className="mt-2 text-sm text-slate-400">yang: {mission.selectedYang} · apis: {mission.selectedApis} · rest: {mission.selectedRest} · agent: {mission.selectedAgent}</p></div>}
        </section>
      </div>
    </main>
  );
}
