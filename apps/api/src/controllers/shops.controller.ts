import type { Request, Response } from "express";
import { z } from "zod";
import {
  createShop,
  getShop,
  getShopStatus,
  listShops,
  requestShopDeletion,
  retryShop,
  updateShop,
  updateShopContent,
} from "../services/shop.service.js";

const shopInputSchema = z.object({
  name: z.string().optional(),
  slug: z.string().optional(),
});

const storefrontContentSchema = z.object({
  tagline: z.string().trim().max(120),
  description: z.string().trim().max(1500),
  announcement: z.string().trim().max(160),
  accentColor: z.string().regex(/^#[\da-fA-F]{6}$/, "Accent color must be a six-digit hex color"),
  products: z.array(z.object({
    id: z.string().trim().min(1).max(100),
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(400),
    priceCents: z.number().int().min(0).max(100_000_000),
  })).max(24),
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

export async function updateContent(request: Request, response: Response) {
  const shopId = getShopId(request, response);
  if (!shopId) return;
  const result = storefrontContentSchema.safeParse(request.body ?? {});
  if (!result.success) {
    response.status(400).json({ error: "Storefront content is invalid. Check the text, color, and product fields." });
    return;
  }

  const shop = await updateShopContent(request.user!.id, shopId, result.data);
  response.json({ shop });
}

export async function remove(request: Request, response: Response) {
  const shopId = getShopId(request, response);
  if (!shopId) return;
  const shop = await requestShopDeletion(request.user!.id, shopId);
  response.status(202).json({ shop });
}

export async function retry(request: Request, response: Response) {
  const shopId = getShopId(request, response);
  if (!shopId) return;
  const shop = await retryShop(request.user!.id, shopId);
  response.status(202).json({ shop });
}
