import type { LabTemplate } from "./labs";

/**
 * iBGP route-reflector lab — the cluster-list tie-breaker hands-on.
 *
 * Completes the BGP best-path story: after the eBGP weight lab (3.2.c) taught
 * weight vs AS path, this lab practices the late tie-breaker (step 12 of the
 * 13-step ladder, right before the lowest-neighbor-address step) — the
 * cluster list — inside an iBGP route-reflector design. Two classic RR
 * faults:
 *   A — a missing route-reflector-client statement (the reflected path never
 *       reaches the client, so only the longer-cluster-list path exists)
 *   B — a shared cluster-id between reflectors (the redundant reflected route
 *       is suppressed as a cluster loop, killing the backup path)
 *
 * Same engine contract: two variants, inspect → diagnose → configure →
 * verify, alternate commands accepted, fixes variant-aware and rejected
 * cross-variant.
 */
export const LAB_TEMPLATES_EXTRA7: LabTemplate[] = [
  {
    id: "lab-ibgp-rr",
    title: "The reflector that never reflects",
    objectiveIds: ["3.2.c"],
    skill: "troubleshoot",
    simulatorNote: "Cluster-list state here is text-based; on real IOS XE use show ip bgp <prefix> to see the Cluster list under each path and show ip bgp summary for session states. Build a client + two-route-reflector iBGP design on CML, EVE-NG, or a DevNet CSR1000v lab to watch reflected paths and cluster-loop suppression live. Note that on real IOS any cluster-id distinct from the peer's resolves the variant B collision — the exact id is pinned here only for determinism.",
    scenario: "A client router should see two iBGP paths to the remote prefix — a direct one via its local route reflector and a redundant one via a second reflector. It only sees one, and the one it sees is the longer-cluster-list path.",
    variants: [
      {
        id: "a",
        label: "Variant A · route-reflector-client never configured",
        symptom: "R1 (the local route reflector, cluster 1.1.1.1) receives the prefix from its client R5 but never reflects it to client R3 — the neighbor R3 route-reflector-client statement is missing, so R3 only has the path via the nested reflectors (cluster list 2.2.2.2, 3.3.3.3).",
        addressing: "Client R3 (10.0.0.3) peers with RR R1 (10.0.0.1, cluster 1.1.1.1); R5 (10.0.0.5) is a client of R1; backup path reflects via R2 (10.0.0.2) and R2b (10.0.0.9, cluster 3.3.3.3)",
        interfaces: "R1 Lo0 10.255.0.1; R3 Lo0 10.255.0.3; iBGP over loopbacks",
        distractors: ["bgp cluster-id 1.1.1.1", "neighbor 10.0.0.9 route-reflector-client", "network 10.1.0.0 mask 255.255.255.0"],
        values: { prefix: "10.1.0.0/24", client: "10.0.0.3", fix: "neighbor 10.0.0.3 route-reflector-client", shortCluster: "1.1.1.1", longCluster: "2.2.2.2, 3.3.3.3", rrName: "R1", directHop: "10.0.0.1", backupHop: "10.0.0.9" },
      },
      {
        id: "b",
        label: "Variant B · shared cluster-id suppresses the redundant path",
        symptom: "R2 (the backup reflector) is configured with bgp cluster-id 1.1.1.1 — the SAME id as R1. When R2 reflects R1's route to R3 it sees its own cluster-id already in the list and suppresses it (cluster-loop prevention), so R3 only has the single path via R1 and the redundancy is dead.",
        addressing: "Client R3 (10.0.0.3) peers with RRs R1 (10.0.0.1) and R2 (10.0.0.2); both RRs should be distinct clusters",
        interfaces: "R2 Lo0 10.255.0.2; iBGP over loopbacks; R2 cluster-id currently 1.1.1.1",
        distractors: ["neighbor 10.0.0.3 route-reflector-client", "bgp cluster-id 3.3.3.3", "maximum-paths 2"],
        values: { prefix: "172.16.0.0/24", client: "10.0.0.3", fix: "bgp cluster-id 2.2.2.2", shortCluster: "1.1.1.1", longCluster: "1.1.1.1, 2.2.2.2", rrName: "R2", directHop: "10.0.0.1", backupHop: "10.0.0.2" },
      },
    ],
    steps: [
      {
        kind: "inspect",
        title: "Inspect the reflected paths",
        prompt: "Show the client's BGP table entry for the prefix, including the cluster list of each path, and confirm the reflector sessions are up.",
        commands: ["show ip bgp", "show ip bgp 10.1.0.0/24", "show ip bgp 172.16.0.0/24", "show ip bgp summary"],
        output: (variant) =>
          variant.values!.fix.startsWith("neighbor")
            ? `BGP routing table entry for ${variant.values!.prefix}, version 7\nPaths: (1 available, best #1)\n  Path #1: (Received by speaker 0)\n  Origin IGP, metric 0, localpref 100, valid, internal, best\n  Cluster list:  ${variant.values!.longCluster}\n\n(no path via ${variant.values!.rrName} — the reflected route never arrived; only the longer-cluster-list path exists)`
            : `BGP routing table entry for ${variant.values!.prefix}, version 7\nPaths: (1 available, best #1)\n  Path #1: (Received by speaker 0)\n  Origin IGP, metric 0, localpref 100, valid, internal, best\n  Cluster list:  ${variant.values!.shortCluster}\n\n(only the direct path exists — the backup reflector's route was suppressed, so redundancy is dead)`,
        wrongHint: "show ip bgp <prefix> lists each path's cluster list — the missing path is the clue to which reflector is broken.",
        explain: "A client only sees a reflected path when the reflector actually reflects it — and only when the route survives the cluster-loop check.",
      },
      {
        kind: "diagnose",
        title: "Diagnose the fault",
        prompt: "The client sees one path instead of two. What is wrong with the route-reflector design?",
        options: [
          { value: "rr", title: "A route-reflector fault hides one of the two paths", note: "Missing route-reflector-client (A) or a shared cluster-id suppressing the reflected route (B)" },
          { value: "med", title: "MED differs between the paths", note: "MED ties — and it is compared long before cluster list anyway" },
          { value: "adjacency", title: "An iBGP session to a reflector is down", note: "show ip bgp summary shows all sessions Established — the peer is reachable" },
        ],
        correct: "rr",
        wrongHint: "The missing path points at the reflector: either it never reflects to the client (no route-reflector-client) or the route was suppressed by a cluster-id collision.",
        explain: "Route reflection needs the client statement — and distinct cluster ids — otherwise the reflected path is absent, leaving only the longer-cluster-list route.",
      },
      {
        kind: "configure",
        title: "Apply the fix",
        prompt: "Restore the missing reflected path so the client sees both paths.",
        acceptedCommands: (variant) => [variant.values!.fix],
        appliedOutput: (variant) =>
          variant.values!.fix.startsWith("neighbor")
            ? `${variant.values!.rrName}(config)# router bgp 65000\n${variant.values!.rrName}(config-router)# ${variant.values!.fix}\n${variant.values!.rrName}(config-router)#\n%BGP-5-ADJCHANGE: neighbor ${variant.values!.client} is now a route-reflector client\n(R5's prefix will now be reflected to R3)` 
            : `${variant.values!.rrName}(config)# router bgp 65000\n${variant.values!.rrName}(config-router)# ${variant.values!.fix}\n${variant.values!.rrName}(config-router)#\n%CLUSTER: local cluster-id changed to 2.2.2.2\n(reflected routes from R1 now carry a foreign cluster id and are no longer suppressed)`,
        wrongHint: "For variant A configure the reflector client on the local RR: neighbor <client-ip> route-reflector-client. For variant B give the backup reflector its own cluster-id: bgp cluster-id 2.2.2.2.",
        explain: "Declaring the client (A) or separating the cluster ids (B) lets the second path be reflected — so the client can compare cluster lists.",
      },
      {
        kind: "verify",
        title: "Verify both paths",
        prompt: "Confirm the client now sees both iBGP paths and the shorter-cluster-list path is best.",
        commands: ["show ip bgp", "show ip bgp 10.1.0.0/24", "show ip bgp 172.16.0.0/24"],
        output: (variant) =>
          `BGP routing table entry for ${variant.values!.prefix}, version 8\nPaths: (2 available, best #1)\n  Path #1: (Received by speaker 0)\n  Origin IGP, metric 0, localpref 100, valid, internal, best\n  Cluster list:  ${variant.values!.shortCluster}\n  Path #2: (Received by speaker 0, via ${variant.values!.backupHop})\n  Origin IGP, metric 0, localpref 100, valid, internal\n  Cluster list:  ${variant.values!.longCluster}\n\n(shortest cluster list wins — the direct path via ${variant.values!.directHop} holds '>')`,
        wrongHint: "Re-run show ip bgp <prefix> — both paths must be present and the '>' must sit on the shorter cluster list.",
        explain: "With both paths present, the late tie-breaker (step 12 of 13) decides: the shorter cluster list is preferred, confirming the redundant path is now visible AND the correct best path is chosen.",
      },
    ],
  },
];
