# OneShopPlatform Implementation Plan

## Product Goal

Build a platform where an authenticated user can create and deploy an online shop with one click. The platform manages the infrastructure through Kubernetes so the user only sees a simple shop-management experience.

The first release is intentionally limited to shop lifecycle management. A shop contains only:

- `id`
- `ownerUserId`
- `name`
- `slug`
- `url`
- `status`
- `createdAt`
- `updatedAt`

The UI should be minimal, fast, and focused on creating, viewing, editing, and deleting shops.

## Recommended Architecture

- **Web application:** Next.js with TypeScript for the dashboard and public shop route
- **API:** Node.js with TypeScript for authentication, shop CRUD, deployment orchestration, and status reporting
- **Database:** PostgreSQL for users and shops
- **Provisioning worker:** handles long-running Kubernetes operations outside the HTTP request
- **Kubernetes:** Deployments, Services, and Ingress resources for shop workloads
- **Container registry:** stores the standard shop image
- **Ingress controller:** routes the platform host and path-based shop URLs to the correct Service

For the first deployable version, use a standard, reusable shop image. A shop creation request should create a shop record and a provisioning job. The worker then creates or updates the Kubernetes resources and reports `PROVISIONING`, `READY`, or `ERROR`.

Avoid making the API server directly wait for pod creation. Kubernetes operations can take time and can fail independently, so provisioning must be asynchronous and retryable.

## Phases

### Phase 0: Decisions and Project Foundation

**Goal:** remove architectural ambiguity before writing product code.

#### Decisions

- **Language:** TypeScript across the frontend, API, worker, and shared types.
- **Frontend:** Next.js using the App Router for the dashboard and public shop pages.
- **Backend:** Node.js with a separate TypeScript API service. The API owns authentication, authorization, shop CRUD, and provisioning jobs.
- **Database:** PostgreSQL. Use migrations and a typed database access layer; the API is the only component that writes shop data.
- **Local Kubernetes:** `kind` with a local container image workflow. The first local cluster will contain the platform services and a test shop workload.
- **Shop URL strategy:** path-based URLs under one platform host, for example `http://localhost/shops/my-shop` locally and `https://platform.example/shops/my-shop` in a deployed environment. Subdomains and custom domains are deferred.
- **Initial deployment model:** one standard shop image can be deployed as a separate Kubernetes workload per shop. This preserves the one-click deployment behavior while keeping the shop runtime identical for every tenant.
- **Provisioning model:** asynchronous jobs handled by a worker. API requests do not wait for Kubernetes resources to become ready.
- **Authentication:** begin with an application-owned user identity and session-based authentication. The client cannot submit or change `ownerUserId`.
- **Shop lifecycle:** `PROVISIONING`, `READY`, `UPDATING`, `DELETING`, and `ERROR`.

Tasks:

- Create the initial repository structure:
	- `apps/web`: Next.js frontend
	- `apps/api`: Node.js TypeScript API
	- `apps/worker`: TypeScript provisioning worker
	- `packages/shared`: shared types and validation schemas
	- `packages/config`: shared TypeScript and lint configuration
	- `infra/kind`: local `kind` cluster configuration
	- `infra/kubernetes`: platform and shop workload manifests
- Define environment variables for PostgreSQL, authentication, platform URL, Kubernetes namespace, and container image.
- Add formatting, linting, typechecking, and test commands that run consistently from the repository root.
- Create a `kind` cluster configuration with an ingress controller and a dedicated `oneshop` namespace.
- Document how to build the standard shop image, load it into `kind`, apply platform manifests, and verify the cluster.
- Define API conventions: JSON responses, consistent error shape, authenticated ownership checks, and status transitions.
- Define the database migration strategy and the first health/readiness checks for the web, API, worker, and PostgreSQL services.

#### Phase 0 Exit Criteria

- The repository structure exists and can be installed from a clean checkout.
- TypeScript compilation, linting, formatting, and tests have root-level commands.
- PostgreSQL is reachable from the API in the local development environment.
- A `kind` cluster can be created with the documented command.
- The `oneshop` namespace and ingress controller are available in the cluster.
- The chosen path-based URL convention is documented and does not require wildcard DNS.
- The stack, authentication boundary, API conventions, environment variables, and lifecycle states are documented and reproducible.

### Phase 1: Shop Domain and Database

**Goal:** implement the shop model independently of Kubernetes.

Tasks:

- Create the users and shops database tables and migrations.
- Add a unique slug constraint and an ownership index.
- Implement server-side validation for names, slugs, and URL-safe input.
- Implement ownership checks so users can access only their own shops.
- Add repository/service tests for create, list, update, delete, duplicate slug, and unauthorized access.

**Exit criteria:** shop CRUD works against PostgreSQL and is covered by automated tests.

### Phase 2: Minimal Dashboard and Public Shop

**Goal:** give users a complete non-Kubernetes product workflow.

Tasks:

- Build a minimal authenticated dashboard showing the user’s shops.
- Add a create-shop form with name input and generated or editable slug.
- Add edit and delete flows with confirmation for deletion.
- Show shop URL and deployment status.
- Add a public shop page that displays the shop name and a basic “shop is ready” state.
- Handle loading, empty, validation, error, and mobile states.

**Exit criteria:** a user can sign in, create, edit, view, and delete a shop through the UI without manually calling the API.

### Phase 3: Containerized Standard Shop

**Goal:** package the public shop as a repeatable workload.

Tasks:

- Create the standard shop container image.
- Add a health endpoint and a readiness probe.
- Make shop identity configurable through environment variables or a tenant identifier.
- Build the image in CI and push it to a container registry.
- Run the image locally and verify it serves the expected shop.

**Exit criteria:** the same immutable image can serve a shop in local development and Kubernetes.

### Phase 4: Kubernetes Provisioning Service

**Goal:** connect one-click shop creation to Kubernetes safely.

Tasks:

- Create a provisioning worker or queue consumer.
- On shop creation, enqueue an idempotent provisioning job.
- Generate Kubernetes resources using labels containing the shop ID:
	- Deployment
	- Service
	- Ingress or Gateway route
- Use deterministic resource names such as `shop-{shopId}`.
- Apply resource limits, requests, readiness probes, and a non-root security context.
- Update the database status as resources progress.
- Retry transient failures with a limit and record an error message for the dashboard.
- Make repeated jobs safe: apply/update existing resources instead of creating duplicates.
- Add deletion cleanup that removes all resources associated with the shop.

**Exit criteria:** creating a shop eventually produces a healthy workload and reachable URL; deleting a shop removes its Kubernetes resources.

### Phase 5: End-to-End One-Click Workflow

**Goal:** make provisioning feel like one action to the user.

Tasks:

- Return a successful creation response immediately after the database record and job are accepted.
- Poll or subscribe to deployment status from the dashboard.
- Disable conflicting actions while a shop is provisioning or deleting.
- Make retries and failed deployments visible and actionable.
- Test the complete flow: create, wait for ready, open URL, edit, and delete.
- Test duplicate submissions and refreshes during provisioning.

**Exit criteria:** the one-click workflow is reliable from the user’s perspective, including failure and retry paths.

### Phase 6: Kubernetes Production Deployment

**Goal:** deploy the platform itself securely and repeatably.

Tasks:

- Containerize the frontend, API, and worker.
- Add Kubernetes manifests or Helm charts for platform components.
- Configure PostgreSQL as a managed database or a properly backed-up cluster service.
- Configure Ingress, DNS, TLS certificates, and the shop URL domain.
- Store credentials in a secret manager or Kubernetes Secrets backed by a secret manager.
- Add namespaces, service accounts, and least-privilege RBAC for the provisioning worker.
- Add network policies, resource quotas, pod disruption settings, and autoscaling where appropriate.
- Add CI/CD for tests, image builds, migrations, and deployment.
- Add logs, metrics, alerts, backups, and a disaster-recovery procedure.

**Exit criteria:** a new environment can be deployed from version-controlled configuration and operators can diagnose failed provisioning.

### Phase 7: Hardening and Expansion

**Goal:** prepare the platform for real usage without expanding the shop feature set prematurely.

Tasks:

- Add rate limits, audit logs, request correlation IDs, and security scanning.
- Add quotas per user and cleanup for abandoned failed deployments.
- Test concurrent shop creation and Kubernetes API outages.
- Add custom domains only after the base URL flow is stable.
- Consider a shared multi-tenant runtime if pod-per-shop cost becomes too high.
- Add products, themes, payments, and analytics as separate product phases.

**Exit criteria:** the platform has clear operational limits, security controls, and a measured path to scale.

## Initial API Contract

```text
GET    /api/shops
POST   /api/shops              { name, slug? }
GET    /api/shops/:id
PATCH  /api/shops/:id          { name, slug? }
DELETE /api/shops/:id
GET    /api/shops/:id/status
```

The API must derive `ownerUserId` from the authenticated session rather than accepting it from the client.

## Important Constraints

- A pod is an implementation detail; the API should expose shop status and URL, not Kubernetes internals.
- Provisioning must be asynchronous, idempotent, observable, and retryable.
- Kubernetes RBAC must restrict the worker to the resources and namespace it needs.
- Deletion must clean up Kubernetes resources and database state consistently.
- Do not add products, payments, inventory, themes, or analytics until the shop lifecycle is stable.

## MVP Definition of Done

- A user can authenticate.
- A user can create, list, edit, and delete only their own shops.
- A unique URL is generated for every shop.
- Creating a shop starts Kubernetes provisioning automatically.
- The dashboard shows provisioning, ready, and error states.
- A ready shop displays its name at its public URL.
- Deleting a shop removes its workload and route.
- Automated tests cover authorization, CRUD, provisioning retries, idempotency, and cleanup.
- The platform is deployable to a local Kubernetes cluster and one production-like cluster.
