import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedUser } from "../types.js";

const SESSION_COOKIE = "oneshop_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters");
  }
  return secret;
}

function sign(value: string) {
  return createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function createSession(userId: string) {
  const payload = `${userId}.${Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS}`;
  return `${payload}.${sign(payload)}`;
}

function readSession(request: Request) {
  const cookies = request.headers.cookie?.split(";").map((cookie) => cookie.trim()) ?? [];
  const value = cookies.find((cookie) => cookie.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!value) return null;

  const [userId, expiresAt, signature] = value.split(".");
  if (!userId || !expiresAt || !signature || Number(expiresAt) < Math.floor(Date.now() / 1000)) return null;

  const expected = sign(`${userId}.${expiresAt}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  return userId;
}

export function setSessionCookie(response: Response, userId: string) {
  response.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE}=${createSession(userId)}; HttpOnly; Path=/; Max-Age=${SESSION_TTL_SECONDS}; SameSite=Lax${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}

export function clearSessionCookie(response: Response) {
  response.setHeader("Set-Cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  try {
    const userId = readSession(request);
    if (!userId) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) {
      response.status(401).json({ error: "Authentication required" });
      return;
    }

    request.user = user;
    next();
  } catch (error) {
    next(error);
  }
}