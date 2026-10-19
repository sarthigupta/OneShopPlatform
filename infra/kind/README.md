# Local Kubernetes setup

This setup uses kind with Traefik as the Ingress controller. Traefik is exposed through fixed NodePorts so the kind node can forward local ports 80 and 443 to it.

## Requirements

- Docker Desktop with the Linux container engine running
- kind
- kubectl
- Helm
- Node.js and npm

## Create the cluster

From the repository root, create the cluster and apply the platform namespace and worker :

```powershell
kind create cluster --name oneshop --config infra/kind/cluster.yaml --wait 90s
kubectl apply -f infra/kubernetes/namespace.yaml
kubectl apply -f infra/kubernetes/worker-rbac.yaml
```

The host port mappings are part of kind node creation. If the `oneshop` cluster already exists and was created with a different configuration, recreate it for these mappings to take effect.

## Install Traefik

```powershell
helm repo add traefik https://traefik.github.io/charts
helm repo update
helm upgrade --install traefik traefik/traefik `
  --namespace traefik `
  --create-namespace `
  --values infra/kubernetes/traefik-values.yaml
kubectl rollout status deployment/traefik -n traefik --timeout=180s
```

Traefik watches Kubernetes Ingress resources and uses the default `traefik` IngressClass. Shop routes use the `localhost` host and `/shops/<slug>` path. The kind port mapping exposes these routes at `http://localhost:8080/shops/<slug>` and HTTPS at `https://localhost:8443/shops/<slug>`.

## Build and load the shop image

```powershell
docker build -t oneshop/shop:local -f apps/shop/Dockerfile apps/shop
kind load docker-image oneshop/shop:local --name oneshop
```

The worker uses `SHOP_IMAGE=oneshop/shop:local` by default. Set `PLATFORM_HOST=localhost` and the local PostgreSQL connection variables in the worker's environment before starting it.

## Run the complete local application

Ensure `apps/api/.env` has the local database URL and a `SESSION_SECRET` of at least 32 characters. Create `apps/worker/.env` from `apps/worker/.env.example` and ensure its database URL points to the same local database. The worker uses the current kubeconfig context, so check that it is `kind-oneshop`:

```powershell
kubectl config current-context
npm run dev:all
```

This starts the web app, API, and provisioning worker together. The worker polls the database for new shops, creates their Kubernetes resources, and marks them `READY` after the updated Deployment rollout is available. The dashboard polls active shops and updates their status automatically. The worker runs on the host and uses kubeconfig; it does not yet run as an in-cluster Deployment.

Create a shop through the dashboard. It should appear as `Provisioning...`, change to `ready`, and then show a link to `http://localhost:8080/shops/<slug>`.

## Inspect the cluster

```powershell
kubectl get nodes
kubectl get pods -n traefik
kubectl get all -n oneshop
kubectl get ingress -n oneshop
```

For a shop that remains in `PROVISIONING`, inspect its Deployment and pod events:

```powershell
kubectl describe deployment -n oneshop <shop-deployment-name>
kubectl get pods -n oneshop -o wide
kubectl describe pod -n oneshop <shop-pod-name>
kubectl logs -n oneshop deployment/<shop-deployment-name>
```
