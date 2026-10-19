# Local development and Kubernetes check commands

Run these commands from the repository root in PowerShell. This is a quick reference for checking the local PostgreSQL database, applications, kind cluster, Traefik, and a provisioned shop.

## 1. Check required tools and configuration

```powershell
docker version
kind version
kubectl version --client
helm version
node --version
npm --version
```

Check the selected Kubernetes cluster and the local environment files. Do not paste `.env` contents into public logs or issues because they contain credentials.

```powershell
kubectl config current-context
Test-Path .env
Test-Path apps/api/.env
Test-Path apps/worker/.env
```

The expected context is `kind-oneshop`. The API and worker must use the same local Postgres connection. The worker also needs access to the kubeconfig and the image `oneshop/shop:local` loaded into kind.

## 2. Check PostgreSQL

```powershell
docker compose ps
docker compose logs --tail 50 postgres
docker exec oneshop-postgres pg_isready -U oneshop -d oneshop
```

Start Postgres if it is stopped:

```powershell
docker compose up -d postgres
```

Apply the Prisma migrations from the API workspace:

```powershell
npm --workspace @oneshop/api run prisma:migrate:dev
```

## 3. Check or create the kind cluster

```powershell
kind get clusters
kubectl config get-contexts
kubectl config use-context kind-oneshop
kubectl get nodes -o wide
kubectl cluster-info
```

Create the cluster when `kind get clusters` does not list `oneshop`:

```powershell
kind create cluster --name oneshop --config infra/kind/cluster.yaml --wait 90s
kubectl apply -f infra/kubernetes/namespace.yaml
kubectl apply -f infra/kubernetes/worker-rbac.yaml
```

The cluster config maps host ports `8080` and `8443` to node ports `30080` and `30443` respectively. Shop URLs use `http://localhost:8080/shops/<slug>`. Set `PLATFORM_URL=http://localhost:8080` in `apps/api/.env` too, so the dashboard link uses the mapped port.

## 4. Check Traefik ingress

```powershell
helm list -n traefik
kubectl get pods,services -n traefik -o wide
kubectl get ingressclass
kubectl rollout status deployment/traefik -n traefik --timeout=180s
```

Install or update Traefik if needed:

```powershell
helm repo add traefik https://traefik.github.io/charts
helm repo update
helm upgrade --install traefik traefik/traefik `
  --namespace traefik `
  --create-namespace `
  --values infra/kubernetes/traefik-values.yaml
```

## 5. Check the shop image

Build the shop container and load it into the kind cluster after changing its source or Dockerfile:

```powershell
docker build -t oneshop/shop:local -f apps/shop/Dockerfile apps/shop
kind load docker-image oneshop/shop:local --name oneshop
docker image inspect oneshop/shop:local
```

The worker asks Kubernetes to run this image. Loading the image into local Docker alone does not make it available inside kind.

## 6. Start and check the application processes

Start web, API, and worker together:

```powershell
npm run dev:all
```

Or start a single process in its own terminal:

```powershell
npm run dev:web
npm run dev:api
npm run dev:worker
```

Check API health and the shop route through the local ingress:

```powershell
Invoke-RestMethod http://localhost:4000/health
Invoke-WebRequest http://localhost:8080/shops/<slug>
```

The `/shops/<slug>` request should return a successful response once the shop is ready. Replace `<slug>` with the shop's actual slug; angle brackets are placeholders and should not be typed literally.

## 7. Check Kubernetes resources for shops

List all resources in the platform namespace:

```powershell
kubectl get all,ingress -n oneshop -o wide
kubectl get deployments,services,ingresses,pods -n oneshop -o wide
kubectl get events -n oneshop --sort-by=.lastTimestamp
```

Each shop's Deployment, Service, and Ingress are named `shop-<shop-id>`. Find the Deployment and its pod:

```powershell
kubectl get deployments -n oneshop
kubectl get pods -n oneshop -o wide
```

Inspect one shop. Replace the placeholder with its complete name, such as `shop-cm...`:

```powershell
kubectl describe deployment -n oneshop <shop-deployment-name>
kubectl describe pod -n oneshop <shop-pod-name>
kubectl logs -n oneshop deployment/<shop-deployment-name>
kubectl get service,ingress -n oneshop <shop-deployment-name> -o yaml
```

For a shop stuck in `PROVISIONING` or marked `ERROR`, inspect worker output in the terminal running `dev:all` or `dev:worker`, then check pod events and image status:

```powershell
kubectl get pods -n oneshop
kubectl describe pod -n oneshop <shop-pod-name>
kubectl get events -n oneshop --sort-by=.lastTimestamp
kubectl logs -n oneshop deployment/<shop-deployment-name>
```

Common clues include `ImagePullBackOff` (image not loaded or tag mismatch), `CrashLoopBackOff` (shop process exited), failed readiness probe (shop `/health` endpoint did not respond), and RBAC `Forbidden` errors in worker output.

## 8. Check the worker's Kubernetes permissions

The worker RBAC is scoped to the `oneshop` namespace:

```powershell
kubectl get serviceaccount,role,rolebinding -n oneshop
kubectl auth can-i get deployments -n oneshop --as=system:serviceaccount:oneshop:oneshop-worker
kubectl auth can-i create deployments -n oneshop --as=system:serviceaccount:oneshop:oneshop-worker
kubectl auth can-i delete ingresses -n oneshop --as=system:serviceaccount:oneshop:oneshop-worker
```

These `auth can-i` checks ask whether the worker service account would have the permission. In local development the worker uses your current kubeconfig identity; the service account is relevant if you later run the worker inside Kubernetes.

## 9. Lifecycle and cleanup

Create, update, and delete shops through the dashboard so the database status and worker reconciliation stay in sync. The worker removes Kubernetes resources after the dashboard requests deletion.

Stop the application with `Ctrl+C` in the terminal running it. Stop Postgres while preserving its named data volume:

```powershell
docker compose stop postgres
```

To stop and remove the Postgres container while retaining the named volume, use:

```powershell
docker compose down
```

Removing the kind cluster deletes its Kubernetes resources and local cluster state:

```powershell
kind delete cluster --name oneshop
```
