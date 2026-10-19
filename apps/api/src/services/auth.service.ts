import { Algorithm, hash, verify } from "@node-rs/argon2";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/app-error.js";

const publicUserSelect = { id: true, email: true, name: true } as const;

async function hashPassword(password: string) {
  return hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function registerUser(input: {
  email: string;
  password: string;
  name: string | null;
}) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new AppError("An account with this email already exists", 409);
  }

  try {
    return await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
      },
      select: publicUserSelect,
    });
  } catch (error) {
    // The unique constraint also protects against two concurrent registrations.
    if (isUniqueConstraintError(error)) {
      throw new AppError("An account with this email already exists", 409);
    }
    throw error;
  }
}

export async function authenticateUser(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !(await verify(user.passwordHash, input.password))) {
    throw new AppError("Invalid email or password", 401);
  }

  return { id: user.id, email: user.email, name: user.name };
}

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
