import type { Request, Response } from "express";
import { z } from "zod";
import {
  createShop,
  getShop,
  getShopStatus,
  listShops,
  requestShopDeletion,
  updateShop,
} from "../services/shop.service.js";

const shopInputSchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
});

function getShopId(request: Request, response: Response) {
  const { id } = request.params;
  if (typeof id !== "string") {
    response.status(404).json({ error: "Shop not found" });
    return null;
  }
  return id;
}

export async function list(request: Request, response: Response) {
  const shops = await listShops(request.user!.id);
  response.json({ shops });
}

export async function create(request: Request, response: Response) {
  const result = shopInputSchema.safeParse(request.body ?? {});
  if (!result.success) {
    response.status(400).json({ error: "Shop name and slug must be strings" });
    return;
  }

  const shop = await createShop(request.user!.id, result.data);
  response.status(201).json({ shop });
}

export async function getById(request: Request, response: Response) {
  const shopId = getShopId(request, response);
  if (!shopId) return;
  const shop = await getShop(request.user!.id, shopId);
  response.json({ shop });
}

export async function getStatus(request: Request, response: Response) {
  const shopId = getShopId(request, response);
  if (!shopId) return;
  const shop = await getShopStatus(request.user!.id, shopId);
  response.json({ shop });
}

export async function update(request: Request, response: Response) {
  const shopId = getShopId(request, response);
  if (!shopId) return;
  const result = shopInputSchema.safeParse(request.body ?? {});
  if (!result.success) {
    response.status(400).json({ error: "Shop name and slug must be strings" });
    return;
  }

  const shop = await updateShop(request.user!.id, shopId, result.data);
  response.json({ shop });
}

export async function remove(request: Request, response: Response) {
  const shopId = getShopId(request, response);
  if (!shopId) return;
  const shop = await requestShopDeletion(request.user!.id, shopId);
  response.status(202).json({ shop });
}
