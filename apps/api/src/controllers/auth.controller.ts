import type { Request, Response } from "express";
import { z } from "zod";
import { authenticateUser, registerUser } from "../services/auth.service.js";
import { clearSessionCookie, setSessionCookie } from "../middleware/auth.js";

const emailSchema = z.string().trim().toLowerCase().email();
const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8),
  name: z.string().trim().optional().transform((value) => value || null),
});
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export async function register(request: Request, response: Response) {
  const result = registerSchema.safeParse(request.body);
  if (!result.success) {
    response.status(400).json({
      error: "A valid email and password of at least 8 characters are required",
    });
    return;
  }

  const user = await registerUser(result.data);
  setSessionCookie(response, user.id);
  response.status(201).json({ user });
}

export async function login(request: Request, response: Response) {
  const result = loginSchema.safeParse(request.body);
  if (!result.success) {
    response.status(400).json({ error: "Email and password are required" });
    return;
  }

  const user = await authenticateUser(result.data);
  setSessionCookie(response, user.id);
  response.json({ user });
}

export function logout(_request: Request, response: Response) {
  clearSessionCookie(response);
  response.status(204).send();
}

export function currentUser(request: Request, response: Response) {
  response.json({ user: request.user });
}
