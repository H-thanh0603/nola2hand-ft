-- Keep a single listing reserved while its buyer completes the deposit flow.
ALTER TYPE "ListingStatus" ADD VALUE IF NOT EXISTS 'RESERVED';

-- Password-reset tokens are stored hashed and are invalidated after use.
ALTER TABLE "User"
  ADD COLUMN "passwordResetTokenHash" TEXT,
  ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3);
