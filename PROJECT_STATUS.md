# OneShopPlatform Project Status

**Reviewed:** 20 October 2026  
**Status:** Local MVP implementation in progress; not production ready

This is a code status snapshot, not a runtime verification report. The current shop content publishing flow has not been exercised against a live kind cluster here, and automated tests are not present.

## What the project is

OneShopPlatform aims to let an authenticated user create and manage an online shop from a dashboard. The platform is intended to provision a separate standard shop workload for each shop on Kubernetes, expose it at a stable URL, show lifecycle status, and clean up its resources when the user deletes it.

The repository uses a JavaScript/TypeScript workspace with three applications:

- `apps/web`: Next.js App Router interface.
- `apps/api`: Express API, Prisma data access, PostgreSQL migrations, and authentication.
- `apps/worker`: a polling worker that reconciles shop records with Kubernetes Deployments, Services, and Ingresses.
- `infra`: initial kind cluster, namespace, and worker RBAC files.
- `Plan.md`: intended product scope, phased implementation plan, and MVP definition of done.

The intended product is deliberately narrower than a full ecommerce system. Basic owner-managed storefront copy, styling, and product listings are in scope; inventory, payments, themes, and analytics remain deferred.

## What is implemented

### Foundation and data

- Root npm workspace scripts exist for development, typechecking, web build, and web linting.
- Prisma schema and SQL migrations define users and shops, including unique email and per-owner slug constraints and shop lifecycle statuses.
- Docker Compose defines a local PostgreSQL service.
- kind cluster, namespace, and namespace-scoped worker RBAC configuration are present.

### Accounts and shop API

- Registration and login validate input with Zod and hash passwords with Argon2id.
- The API issues a signed, HTTP-only session cookie and provides logout and current-user endpoints.
- Shop endpoints support listing, creating, fetching, editing, deletion initiation, status lookup, retrying failed operations, and saving owner-managed storefront content.
- Shop routes require authentication and scope shop reads and mutations to the signed-in owner.
- Creation normalizes a slug, checks for a per-owner collision, stores a URL, and starts the record in `PROVISIONING`.

### Web interface

- The home route has sign-in and account creation forms.
- The shops route loads the authenticated user's shops and supports create, edit, delete, and sign-out actions.
- Basic responsive styling, loading, empty, and error states are present.
- A storefront editor saves the shop introduction, announcement, accent color, and product cards through an authenticated owner-scoped API endpoint.
- Next.js rewrites `/api/*` requests to the API service.

### Provisioning prototype

- The worker polls PostgreSQL for `PROVISIONING`, `UPDATING`, and `DELETING` records.
- It creates or replaces a Deployment, Service, and Ingress using deterministic names and shop labels.
- The workload includes resource requests/limits, health probes, and a restrictive container security context.
- Shop content is read from PostgreSQL and supplied to the container through its Deployment environment.
- It marks an available Deployment `READY`, retries work by polling, marks caught errors `ERROR`, and removes Kubernetes resources before deleting the shop row.

## Completion by phase

| Plan phase | Assessment | Evidence and remaining work |
| --- | --- | --- |
| 0. Decisions and foundation | Partially complete | Architecture, workspace, database configuration, kind skeleton, and RBAC exist. There is no shared package/config, complete local cluster setup, ingress-controller install, full environment-variable documentation, or reproducible setup guide. |
| 1. Shop domain and database | Partially complete | User/shop schema, migrations, and owner-scoped CRUD routes exist. Automated tests are absent; validation and failure/edge cases need hardening. |
| 2. Dashboard and public shop | Partially complete | The dashboard refreshes shop lifecycle status, offers retry, and links to a public shop route and storefront editor. End-to-end publication has not been confirmed in this environment. |
| 3. Standard shop container | Implemented locally | A health-checked shop server renders persisted shop content and products. The image is built and loaded into kind by the local startup script. |
| 4. Kubernetes provisioning | Prototype present | Worker reconciliation, readiness checks, retry operation tracking, and RBAC exist. There is no durable queue, bounded retry policy, in-cluster worker deployment, or confirmed live cluster validation. |
| 5. End-to-end one-click flow | Not verified | The code supports provisioning and editing flows, but creating a shop, publishing changes, and cleanup have not been confirmed against a live cluster here. Automated coverage is absent. |
| 6. Production deployment | Not implemented | No platform container manifests/charts, CI/CD, TLS/DNS, managed database plan, secret management, monitoring, backup, or recovery procedure. |
| 7. Hardening and expansion | Not implemented | No rate limiting, audit trail, quotas, concurrency/outage coverage, or operational runbooks. |

### Current completion assessment

The code now includes authentication, owner-scoped shop management, a public storefront, editable persisted content, and a Kubernetes reconciliation path. The defining outcome—an authenticated owner publishes a shop and sees the change at its URL—still needs a successful local cluster run and repeated failure/retry verification. Automated coverage, production deployment, and operations work remain.

## Important gaps and risks to resolve

1. **The public shop is still a basic storefront.** Owners can edit copy, accent color, and product cards, but there are no product images, inventory, cart, or checkout.
2. **Provisioning operations need stronger recovery.** The worker marks failures and lets the owner retry the last operation, but has no attempt limit, backoff, or stored diagnostic message beyond worker logs.
3. **Worker polling can race.** The query selects up to ten jobs without claiming or locking them. Multiple worker instances could process the same shop concurrently. There is no durable job record, attempt count, backoff, or lease.
4. **Shop edits can disrupt a ready shop.** Any PATCH sets status to `UPDATING`, even when fields are unchanged. Slug changes alter the Ingress path, but old routes are not explicitly removed or redirected.
5. **Deletion is asynchronous.** The dashboard keeps the shop visible while deletion is pending and exposes retry if cleanup fails, but completion and partial-failure behavior still need live-cluster verification.
6. **Input and data validation are inconsistent.** Auth uses Zod, while shop routes use casts and ad hoc checks. Shop name length, slug bounds/format, and database errors need consistent handling. A slug is unique only per owner, while the Ingress URL path is shared on one host; two owners may collide at the same public path.
7. **Local environment configuration needs a reproducible pass.** The example environment file documents `DATABASE_URL`, while Prisma and the worker use `DIRECT_URL`. The kind file maps ports but does not install an ingress controller. Setup and image-loading steps are not documented as runnable commands.
8. **No automated tests are present.** Root scripts do not include tests, and the planned authorization, CRUD, worker reconciliation, retry, and cleanup cases are uncovered.
9. **Deployment and operations are absent.** The repository has no Dockerfiles for the applications, CI pipeline, production cluster configuration, secret handling, observability, backup, or recovery workflow.

## Recommended next steps

Work in this order so each step makes the product path more concrete:

### 1. Make local development reproducible

- Align `.env.example`, Prisma configuration, API, and worker on the intended database variables; document which URL is used for runtime and migrations.
- Add a concise local setup guide: install dependencies, start PostgreSQL, run migrations, set required secrets, and start web/API/worker.
- Define how the local kind cluster gets its ingress controller, namespace, and images; document commands and prerequisites.
- Add readiness checks for PostgreSQL, API, and worker startup behavior.

### 2. Verify the storefront and lifecycle flow

- Start the full local stack and verify create → ready → edit content → published update → delete.
- Verify the editor persists changes across browser reloads and that the public page escapes user content safely.
- Exercise worker restart and a temporary Kubernetes failure; confirm the owner can retry the saved operation.
- Define a globally unique public URL strategy. With one shared host and path-based routes, per-owner slug uniqueness alone is not enough.

### 3. Make shop domain behavior safe and tested

- Centralize shop request validation and consistent API error responses.
- Cover registration/login, owner isolation, CRUD, duplicate identifiers, invalid input, and lifecycle transitions with automated tests.
- Decide update semantics for a ready shop, including slug changes and old route cleanup.
- Add root test commands and make typecheck/lint/build/test expectations part of the project guide.

### 4. Harden the provisioning worker

- Use a durable job or a database-backed claim/lease so concurrent workers cannot process the same shop simultaneously.
- Add attempt counts, bounded exponential backoff, and actionable error details visible to the dashboard.
- Wait for workload readiness and only mark `READY` after the shop health check succeeds.
- Make reconciliation and deletion idempotent, including route changes and partially created resources.
- Add worker tests for create/update/delete, retries, missing resources, and Kubernetes API failures.

### 5. Complete and verify the local end-to-end MVP

- Build and load the standard shop image into kind.
- Install ingress, apply the namespace and RBAC, and start the platform services.
- Verify: register → create shop → observe `READY` → open public URL → edit → delete → confirm resources and record are removed.
- Exercise duplicate submissions, browser refresh during provisioning, worker restart, and temporary Kubernetes failure.

### 6. Prepare a production-like deployment

- Containerize web, API, worker, and standard shop runtime; add CI for tests and image builds.
- Choose production database hosting and migration execution strategy.
- Add TLS/DNS, secret management, least-privilege worker permissions, resource quotas, logs/metrics/alerts, database backups, and recovery documentation.
- Validate deployment from a clean environment before calling the MVP complete.

## MVP completion checklist

- [ ] A user can register and sign in.
- [ ] A user can create, list, edit, and delete only their own shops.
- [ ] Each shop has a globally unique, reachable URL.
- [ ] Creation asynchronously provisions a healthy standard shop workload.
- [ ] The dashboard shows provisioning, ready, and actionable error states.
- [ ] A ready shop displays its name at its public URL.
- [ ] Deletion removes the workload, route, and database record reliably.
- [ ] Automated tests cover authorization, CRUD, provisioning retries, idempotency, and cleanup.
- [ ] The platform can be started reproducibly on local Kubernetes and deployed to a production-like cluster.

## Overall assessment

This is a working local implementation rather than a blank scaffold: authentication, owner-scoped shop endpoints, an editable storefront, migrations, and a Kubernetes reconciliation loop are present. The next priority is to verify the full publish flow on the local cluster, then add automated coverage and strengthen worker job handling. Production deployment and operational hardening should follow after the local workflow is reliable.
