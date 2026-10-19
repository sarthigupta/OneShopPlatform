-- Add a temporary default so existing user rows remain valid during rollout.
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT NOT NULL DEFAULT '';

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP DEFAULT;