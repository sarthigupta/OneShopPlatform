import "dotenv/config";
import { AppsV1Api, CoreV1Api, KubeConfig, NetworkingV1Api } from "@kubernetes/client-node";
import pg from "pg";

const { Pool } = pg;
const namespace = process.env.KUBERNETES_NAMESPACE ?? "oneshop";
const image = process.env.SHOP_IMAGE ?? "oneshop/shop:local";
const platformHost = process.env.PLATFORM_HOST ?? "localhost";
const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);
const databaseUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Set DIRECT_URL or DATABASE_URL before starting the worker");

const pool = new Pool({ connectionString: databaseUrl });
const kubeConfig = new KubeConfig();
kubeConfig.loadFromDefault();

const appsApi = kubeConfig.makeApiClient(AppsV1Api);
const coreApi = kubeConfig.makeApiClient(CoreV1Api);
const networkingApi = kubeConfig.makeApiClient(NetworkingV1Api);

type Shop = {
  id: string;
  name: string;
  slug: string;
  status: "PROVISIONING" | "UPDATING" | "DELETING";
};

type ExistingResource = {
  metadata?: { resourceVersion?: string };
  spec?: object;
};

function resourceName(shopId: string) {
  return `shop-${shopId}`;
}

function labels(shopId: string) {
  return {
    "app.kubernetes.io/name": "oneshop-shop",
    "oneshop.io/shop-id": shopId,
  };
}

function deployment(shop: Shop) {
  const name = resourceName(shop.id);
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: { name, namespace, labels: labels(shop.id) },
    spec: {
      replicas: 1,
      selector: { matchLabels: labels(shop.id) },
      template: {
        metadata: { labels: labels(shop.id) },
        spec: {
          securityContext: {
            runAsNonRoot: true,
            seccompProfile: { type: "RuntimeDefault" },
          },
          containers: [
            {
              name: "shop",
              image,
              imagePullPolicy: "IfNotPresent",
              ports: [{ name: "http", containerPort: 3000 }],
              env: [
                { name: "SHOP_NAME", value: shop.name },
                { name: "SHOP_SLUG", value: shop.slug },
              ],
              resources: {
                requests: { cpu: "50m", memory: "64Mi" },
                limits: { cpu: "250m", memory: "256Mi" },
              },
              readinessProbe: {
                httpGet: { path: "/health", port: 3000 },
                initialDelaySeconds: 3,
                periodSeconds: 5,
              },
              livenessProbe: {
                httpGet: { path: "/health", port: 3000 },
                initialDelaySeconds: 10,
                periodSeconds: 10,
              },
              securityContext: {
                allowPrivilegeEscalation: false,
                readOnlyRootFilesystem: true,
                capabilities: { drop: ["ALL"] },
              },
            },
          ],
        },
      },
    },
  };
}

function service(shop: Shop) {
  const name = resourceName(shop.id);
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: { name, namespace, labels: labels(shop.id) },
    spec: {
      selector: labels(shop.id),
      ports: [{ name: "http", port: 80, targetPort: 3000 }],
    },
  };
}

function ingress(shop: Shop) {
  const name = resourceName(shop.id);
  return {
    apiVersion: "networking.k8s.io/v1",
    kind: "Ingress",
    metadata: { name, namespace, labels: labels(shop.id) },
    spec: {
      rules: [
        {
          host: platformHost,
          http: {
            paths: [
              {
                path: `/shops/${shop.slug}`,
                pathType: "Prefix",
                backend: { service: { name, port: { number: 80 } } },
              },
            ],
          },
        },
      ],
    },
  };
}

function getStatusCode(error: unknown) {
  if (!error || typeof error !== "object") return undefined;

  // @kubernetes/client-node ApiException exposes the HTTP status as `code`.
  if ("code" in error && typeof error.code === "number") return error.code;

  if ("statusCode" in error && typeof error.statusCode === "number") {
    return error.statusCode;
  }

  if ("response" in error && error.response && typeof error.response === "object") {
    const response = error.response as { statusCode?: number; status?: number };
    return response.statusCode ?? response.status;
  }

  return undefined;
}

async function applyResource(
  read: () => Promise<ExistingResource>,
  create: () => Promise<unknown>,
  replace: (body: any) => Promise<unknown>,
  desired: { metadata: { [key: string]: unknown } } & Record<string, unknown>,
) {
  try {
    const current = await read();
    await replace({
      ...current,
      ...desired,
      metadata: {
        ...current.metadata,
        ...desired.metadata,
        resourceVersion: current.metadata?.resourceVersion,
      },
      spec: { ...current.spec, ...(desired.spec as object) },
    });
  } catch (error: unknown) {
    if (getStatusCode(error) === 404) {
      await create();
      return;
    }
    throw error;
  }
}

async function reconcile(shop: Shop) {
  const name = resourceName(shop.id);
  await applyResource(
    () => appsApi.readNamespacedDeployment({ name, namespace }),
    () => appsApi.createNamespacedDeployment({ namespace, body: deployment(shop) }),
    (body) => appsApi.replaceNamespacedDeployment({ name, namespace, body }),
    deployment(shop),
  );
  await applyResource(
    () => coreApi.readNamespacedService({ name, namespace }),
    () => coreApi.createNamespacedService({ namespace, body: service(shop) }),
    (body) => coreApi.replaceNamespacedService({ name, namespace, body }),
    service(shop),
  );
  await applyResource(
    () => networkingApi.readNamespacedIngress({ name, namespace }),
    () => networkingApi.createNamespacedIngress({ namespace, body: ingress(shop) }),
    (body) => networkingApi.replaceNamespacedIngress({ name, namespace, body }),
    ingress(shop),
  );

  const current = await appsApi.readNamespacedDeployment({ name, namespace });
  const desiredReplicas = current.spec?.replicas ?? 1;
  const rolloutComplete = current.status?.conditions?.some(
    (condition) =>
      condition.type === "Progressing" &&
      condition.status === "True" &&
      condition.reason === "NewReplicaSetAvailable",
  );
  const deploymentReady =
    rolloutComplete &&
    (current.status?.updatedReplicas ?? 0) >= desiredReplicas &&
    (current.status?.availableReplicas ?? 0) >= desiredReplicas;

  if (deploymentReady) {
    await pool.query(
      'UPDATE "Shop" SET "status" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $2',
      ["READY", shop.id],
    );
  }
}

async function remove(shop: Shop) {
  const name = resourceName(shop.id);
  const removeResources = [
    () => networkingApi.deleteNamespacedIngress({ name, namespace }),
    () => coreApi.deleteNamespacedService({ name, namespace }),
    () => appsApi.deleteNamespacedDeployment({ name, namespace }),
  ];

  for (const removeResource of removeResources) {
    try {
      await removeResource();
    } catch (error: unknown) {
      if (getStatusCode(error) !== 404) throw error;
    }
  }

  await pool.query('DELETE FROM "Shop" WHERE "id" = $1', [shop.id]);
}

let pollRunning = false;

async function poll() {
  if (pollRunning) return;
  pollRunning = true;

  try {
    const result = await pool.query<Shop>(
      'SELECT "id", "name", "slug", "status" FROM "Shop" WHERE "status" IN (\'PROVISIONING\', \'UPDATING\', \'DELETING\') ORDER BY "createdAt" ASC LIMIT 10',
    );

    for (const shop of result.rows) {
      try {
        await (shop.status === "DELETING" ? remove(shop) : reconcile(shop));
      } catch (error) {
        console.error(`Failed to reconcile shop ${shop.id}`, error);
        await pool.query(
          'UPDATE "Shop" SET "status" = $1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $2',
          ["ERROR", shop.id],
        );
      }
    }
  } finally {
    pollRunning = false;
  }
}

async function main() {
  console.log(`Provisioning worker listening in namespace ${namespace}`);
  await poll();
  setInterval(() => void poll().catch((error) => console.error("Worker poll failed", error)), pollIntervalMs);
}

void main();
