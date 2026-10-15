# Security — current local milestone

Phase 1 is a local development application. Do not publish it or expose its backend through a tunnel. Dependency advisories and inherited shared-module browser warnings remain open (see PHASE_0_RUNTIME.md and PHASE_1.md).

CEO controls require a generated 256-bit token, checked server-side for every write. `OFFICE_OWNER_TOKEN` is a backend environment variable; its local copy is `.office/owner-token.txt`. `.office/` and `.env.local` are ignored by Git. The browser stores the supplied token in memory only. The token is a bearer credential: anyone with the value can act as local owner; never share it, put it in a URL, film it or commit it. Public read-only local observation is permitted. Authenticated hosted identity/session management, HTTPS and authorisation review are prerequisites for deployment.

Legacy anonymous join/leave, generic engine inputs, message writes, and stop/resume cannot mutate the office. New financial/research functions must not be reachable through those legacy routes. Internal Convex functions and the local dashboard/CLI are trusted deployment administration: a person with machine or deployment-admin access can change backend secrets and data. The local token does not protect against a compromised development machine.

`OFFICE_PHASE=1` rejects model configuration before external inference requests. No financial APIs, market feeds, order execution or web-research tools are connected. The proposed model label is not verified availability. Every new external service and any billable model tests require their applicable owner checkpoint.

If the local token leaks, replace it securely in the local file and Convex environment, then lock/reload the browser. If environment selection is wrong, stop the local tools and inspect variable names/hosts without sharing secret values. Do not run wiping utilities to recover the office. Preserve the original world and audit history.
