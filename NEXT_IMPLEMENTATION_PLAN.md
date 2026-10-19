# OneShopPlatform Next Implementation Plan

This plan takes the current repository from its early MVP foundation to a working local one-click shop flow. Complete the steps in order; each step produces something the next step can build on.

## Step 1 — Make local development reproducible

**Work**

- Define the required environment variables for web, API, worker, Prisma, and Kubernetes.
- Resolve the `DATABASE_URL` / `DIRECT_URL` distinction and make runtime connections and migrations use the intended URLs consistently.
- Update `.env.example` with safe placeholders only; do not commit real credentials.
- Add a setup guide with install, database, migration, and app startup commands.
- Add service health/readiness behavior and document local prerequisites.

**Done when** a developer can start PostgreSQL, apply migrations, and run web, API, and worker from a clean checkout by following the guide.

## Step 2 — Decide and enforce public URL uniqueness

The current plan uses `/{shops}/{slug}` on one host, but the database only makes slugs unique per owner. Two owners can therefore produce the same route.

**Work**

- Use globally unique slugs for the first release, or choose another URL scheme before implementing the public route. Global slug uniqueness is the simplest fit for the existing path-based design.
- Add the corresponding database constraint/migration and handle collisions with a clear API response.
- Define what happens when a shop changes its slug and how its old route is removed.

**Done when** every shop URL identifies exactly one shop, including after an edit, and duplicate creation is handled predictably.

## Step 3 — Build the public shop application

**Work**

- Add a minimal standard shop app that reads its shop name and slug from configuration.
- Provide a `/health` endpoint for Kubernetes probes.
- Add a Dockerfile and local run instructions.
- Add a public page that displays the shop name and a simple ready state.

**Done when** the same image runs locally with different shop configuration and returns a healthy response.

## Step 4 — Finish the dashboard lifecycle experience

**Work**

- Show each shop's full URL and readable status.
- Refresh status for shops in `PROVISIONING`, `UPDATING`, or `DELETING` until they reach a terminal state.
- Disable conflicting edit/delete actions while a lifecycle operation is active.
- Keep a deleting shop visible until the API confirms deletion; surface failures with useful messages.
- Add a retry action for `ERROR` shops once the API supports it.
- Handle network failures and prevent double submissions in create/edit forms.

**Done when** users can see and understand the full lifecycle without refreshing manually or calling the API directly.

## Step 5 — Harden API validation and lifecycle rules

**Work**

- Validate shop create/update bodies with shared Zod schemas.
- Set sensible name and slug length/format limits and return consistent error shapes.
- Preserve owner-scoped access on every endpoint and ensure the client cannot set ownership or status.
- Avoid unnecessary `UPDATING` transitions when submitted values have not changed.
- Define behavior for edits while provisioning/deleting and for slug changes.
- Add an authenticated retry endpoint or operation for failed provisioning.

**Done when** invalid input, duplicate slugs, unauthorized access, and invalid state transitions return predictable responses.

## Step 6 — Make provisioning safe to retry and run concurrently

**Work**

- Claim work in the database (for example, with a lease/claim timestamp and atomic update) so concurrent workers do not process the same shop simultaneously.
- Track attempts and last error; retry transient errors with bounded backoff and stop after a configured limit.
- Wait for Deployment readiness before setting `READY`.
- Store a user-safe error message and retain diagnostic details in worker logs.
- Make create, update, slug-route replacement, and delete idempotent, including partial failures.
- Ensure the worker closes its database pool and handles shutdown signals cleanly.

**Done when** worker restarts, duplicate polls, partial resource creation, and temporary Kubernetes errors do not leave shops permanently stuck or create duplicate workloads.

## Step 7 — Add automated coverage

**Work**

- Add API tests for authentication, ownership isolation, CRUD, validation, duplicate slugs, and lifecycle state rules.
- Add worker tests for resource reconciliation, readiness, retry limits, deletion cleanup, and Kubernetes errors using mocked clients.
- Add web-level coverage for form errors and status display where practical.
- Add root `test` scripts and document the supported verification commands.

**Done when** the key domain and provisioning behaviors can be checked automatically without requiring a live production cluster.

## Step 8 — Stand up the local Kubernetes path

**Work**

- Install/configure an ingress controller for the existing kind cluster definition.
- Use Traefik for local Ingress routing; the community Ingress NGINX controller was retired in March 2026.
- Apply the namespace and worker RBAC.
- Build and load the standard shop image into kind.
- Run the platform services with the correct database and Kubernetes configuration.
- Document a repeatable reset/setup path for the local cluster.

**Done when** an Ingress route on the local platform host reaches the correct shop workload.

## Step 9 — Verify the complete MVP flow

Run the following against the local stack and record the result in the setup guide:

1. Register a user and sign in.
2. Create a shop and confirm the API responds before the workload is ready.
3. Watch the dashboard move from `PROVISIONING` to `READY`.
4. Open the shop URL and confirm it displays the configured shop name.
5. Edit the shop and confirm its public route and details update.
6. Delete the shop and confirm the dashboard, database, Deployment, Service, and Ingress are cleaned up.
7. Repeat with duplicate slugs, refresh during provisioning, worker restart, and a temporary Kubernetes failure.

**Done when** the above cases work repeatedly and failure cases produce visible, recoverable states.

## Step 10 — Prepare production deployment

Start this after the local MVP flow is stable.

**Work**

- Containerize web, API, and worker and add CI for lint, typecheck, tests, and image builds.
- Choose production database hosting and a safe migration process.
- Add cluster manifests or Helm charts, TLS/DNS, secret management, and least-privilege service accounts/RBAC.
- Add resource quotas, logs, metrics, alerts, backups, and a recovery runbook.
- Deploy to a production-like environment and verify the same end-to-end flow.

**Done when** a clean environment can be deployed from version-controlled configuration and operators can diagnose and recover from failed provisioning.

## Recommended immediate starting point

Begin with **Steps 1 and 2**. They remove configuration and URL ambiguity before more UI or worker behavior depends on them. Then build the standard shop image (Step 3) and complete the dashboard (Step 4), followed by API and worker reliability work.

## MVP completion gate

Call the MVP complete only when a user can authenticate, create a globally addressable shop, see it become ready, open its public URL, edit it, and delete it with Kubernetes resources cleaned up—and the core authorization, lifecycle, retry, and cleanup behavior is covered by automated checks.
