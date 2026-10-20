# OneShop Platform

OneShop is a local shop hosting platform. Users can register, create shops, and watch each shop move from provisioning to ready. The API stores shop state in PostgreSQL, a provisioning worker turns that state into Kubernetes resources, and Traefik routes requests to the running shop.

> **Project status:** This is an active local development project. The shop runtime is an editable starter storefront with a basic product listing. The provisioning worker currently runs on the developer machine and uses the active kubeconfig context to manage a local kind cluster.

## Features

- User registration, login, logout, and cookie-based sessions
- Shop create, list, update, status, and delete API operations
- Owner-editable storefront copy, announcement, accent color, and product cards persisted in PostgreSQL
- PostgreSQL persistence with Prisma migrations
- Automatic shop provisioning and deletion through a polling worker
- Retry action for failed provisioning, updates, and deletions
- Per-shop Kubernetes Deployment, Service, and Ingress
- Local kind cluster with Traefik ingress
- Dashboard status refresh while shops are provisioning, updating, or deleting

## Architecture

```mermaid
flowchart LR
  User[User browser] --> Web[Next.js dashboard]
  Web --> API[Express API]
  API --> DB[(PostgreSQL)]
  Worker[Provisioning worker] --> DB
  Worker -->|Kubernetes API| Kind[kind cluster]
  Kind --> Deploy[Shop Deployment and Pod]
  Deploy --> Service[Shop Service]
  Traefik[Traefik] -->|Ingress rule| Service
  User -->|localhost:8080/shops/slug| Traefik
```

When a shop is created, the API records it as `PROVISIONING`. The worker polls for pending shops and creates a Deployment, Service, and Ingress in the `oneshop` namespace. Kubernetes starts the shop container and checks its `/health` endpoint. Once the Deployment is available, the worker marks the database record `READY`; the dashboard refreshes and displays the shop URL. Owners can open the storefront editor from the dashboard. Its content is saved as JSON in the shop's PostgreSQL record, then passed to the shop container during reconciliation so the Deployment publishes the latest content.

## Technology

- **Web:** Next.js and React
- **API:** Express, TypeScript, Zod
- **Data:** PostgreSQL, Prisma, `pg`
- **Provisioning:** Node.js worker and Kubernetes client
- **Local Kubernetes:** kind, kubectl, Helm, Traefik
- **Shop runtime:** Node.js HTTP server in a Docker image

## Prerequisites

- Node.js 22 or newer and npm
- Docker Desktop using the Linux container engine
- kind, kubectl, and Helm

## Run locally

Commands below use PowerShell from the repository root.

### 1. Install dependencies once

```powershell
npm install
```

### 2. Start the full local development stack

```powershell
npm run start:local
```

This command prepares environment files, starts PostgreSQL, creates or reuses kind, configures Traefik, builds and loads the shop image, generates Prisma Client, applies all migrations, then starts the dashboard, API, and worker. It requires Docker Desktop, kind, kubectl, Helm, and Node.js installed. Open [http://localhost:3000](http://localhost:3000), register an account, and create a shop. Once ready, use **Manage storefront** to edit its announcement, introduction, accent color, and product cards. The public page is available at `http://localhost:8080/shops/<slug>`.

To stop the application, press `Ctrl+C` in the terminal. Stop Postgres while preserving its data with `docker compose stop postgres`.

## Useful commands

```powershell
# Check cluster and platform resources
kubectl get nodes
kubectl get pods -n traefik
kubectl get deployments,services,ingresses,pods -n oneshop -o wide

# Check API health
Invoke-RestMethod http://localhost:4000/health

# Run TypeScript checks for the existing applications
npm run typecheck:api
npm run typecheck:worker
npm run typecheck:web
```

For more commands to diagnose shops and Kubernetes resources, see [LOCAL_CHECK_COMMANDS.md](LOCAL_CHECK_COMMANDS.md). For explanations of the repository files, YAML resources, and lifecycle flow, see [PROJECT_FILE_GUIDE.md](PROJECT_FILE_GUIDE.md). The detailed kind setup is in [infra/kind/README.md](infra/kind/README.md).

## Shop lifecycle

| Status | Meaning |
| --- | --- |
| `PROVISIONING` | The worker is creating the shop's Kubernetes resources and waiting for its Deployment. |
| `READY` | The shop Deployment is available. |
| `UPDATING` | The worker is applying changed shop settings. |
| `DELETING` | The worker is removing the shop's Kubernetes resources and database record. |
| `ERROR` | A shop operation failed. Inspect worker output and Kubernetes events, then use **Retry** in the dashboard to repeat the failed operation. |

## Project layout

```text
apps/
  api/       Express API, Prisma schema and migrations
  shop/      Containerized sample shop server
  web/       Next.js dashboard
  worker/    Database polling and Kubernetes reconciliation
infra/
  kind/      Local kind cluster configuration and setup guide
  kubernetes/Namespace, worker RBAC, and Traefik Helm values
scripts/     Local development process launcher
```

## Cleanup

Delete the kind cluster and its resources with:

```powershell
kind delete cluster --name oneshop
```

Postgres data is stored in the named `postgres-data` Docker volume and remains when you run `docker compose down`. To remove the database data too, use `docker compose down --volumes`.
