import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/app-error.js";

export type ShopInput = {
  name?: string;
  slug?: string;
};

function normalizeSlug(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function buildShopUrl(slug: string) {
  return `${process.env.PLATFORM_URL ?? "http://localhost:8080"}/shops/${slug}`;
}

export async function listShops(ownerUserId: string) {
  return prisma.shop.findMany({
    where: { ownerUserId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createShop(ownerUserId: string, input: ShopInput) {
  const name = input.name?.trim() ?? "";
  if (!name) throw new AppError("Shop name is required", 400);

  const slug = normalizeSlug(input.slug?.trim() || name);
  if (!slug) throw new AppError("Slug is invalid", 400);

  const existingShop = await prisma.shop.findUnique({
    where: { ownerUserId_slug: { ownerUserId, slug } },
    select: { id: true },
  });
  if (existingShop) {
    throw new AppError("A shop with this slug already exists", 409);
  }

  try {
    return await prisma.shop.create({
      data: {
        ownerUserId,
        name,
        slug,
        url: buildShopUrl(slug),
        status: "PROVISIONING",
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError("A shop with this slug already exists", 409);
    }
    throw error;
  }
}

export async function getShop(ownerUserId: string, shopId: string) {
  const shop = await prisma.shop.findFirst({
    where: { id: shopId, ownerUserId },
  });
  if (!shop) throw new AppError("Shop not found", 404);
  return shop;
}

export async function updateShop(ownerUserId: string, shopId: string, input: ShopInput) {
  const existingShop = await getShop(ownerUserId, shopId);
  const name = input.name === undefined ? existingShop.name : input.name.trim();
  const slug = input.slug === undefined ? existingShop.slug : normalizeSlug(input.slug);

  if (!name) throw new AppError("Shop name is required", 400);
  if (!slug) throw new AppError("Slug is invalid", 400);

  const duplicateShop = await prisma.shop.findFirst({
    where: { ownerUserId, slug, NOT: { id: shopId } },
    select: { id: true },
  });
  if (duplicateShop) {
    throw new AppError("A shop with this slug already exists", 409);
  }

  try {
    return await prisma.shop.update({
      where: { id: shopId },
      data: {
        name,
        slug,
        url: buildShopUrl(slug),
        status: "UPDATING",
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new AppError("A shop with this slug already exists", 409);
    }
    throw error;
  }
}

export async function requestShopDeletion(ownerUserId: string, shopId: string) {
  const existingShop = await getShop(ownerUserId, shopId);
  await prisma.shop.update({
    where: { id: shopId },
    data: { status: "DELETING" },
  });
  return { ...existingShop, status: "DELETING" as const };
}

export async function getShopStatus(ownerUserId: string, shopId: string) {
  const shop = await prisma.shop.findFirst({
    where: { id: shopId, ownerUserId },
    select: { id: true, status: true, url: true },
  });
  if (!shop) throw new AppError("Shop not found", 404);
  return shop;
}

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
