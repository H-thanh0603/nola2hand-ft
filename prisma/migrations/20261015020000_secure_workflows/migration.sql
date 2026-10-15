BEGIN;
ALTER TABLE "User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "canManageRoles" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
UPDATE "User" SET "emailVerifiedAt" = "createdAt" WHERE "googleId" IS NOT NULL OR (email IN ('buyer@nola2hand.vn','seller@nola2hand.vn') AND "isVerified" = true);
UPDATE "User" u SET "canManageRoles" = true WHERE email = 'finance@nola2hand.vn' AND EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id=ur."roleId" WHERE ur."userId"=u.id AND r.name='ADMIN_FINANCE');
CREATE TABLE "WithdrawalRequest" (
 "id" SERIAL PRIMARY KEY, "userId" INTEGER NOT NULL REFERENCES "User"(id), "requestKey" TEXT NOT NULL,
 "reference" TEXT NOT NULL UNIQUE, "amount" INTEGER NOT NULL CHECK (amount > 0), "fee" INTEGER NOT NULL DEFAULT 0 CHECK (fee >= 0),
 "bankName" TEXT NOT NULL, "accountNumber" TEXT NOT NULL, "accountName" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','PAID','REJECTED','FAILED','CANCELLED')),
 "resolution" TEXT, "transferReference" TEXT, "paidAt" TIMESTAMP(3), "handledBy" INTEGER,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "WithdrawalRequest_userId_requestKey_key" ON "WithdrawalRequest"("userId","requestKey");
CREATE INDEX "WithdrawalRequest_status_createdAt_idx" ON "WithdrawalRequest"("status","createdAt");
CREATE TABLE "ReturnRequest" (
 "id" SERIAL PRIMARY KEY, "orderId" INTEGER NOT NULL UNIQUE REFERENCES "Order"(id), "reference" TEXT NOT NULL UNIQUE,
 "status" TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED','APPROVED','SHIPPED','RECEIVED','REFUNDED','REJECTED','CANCELLED')),
 "originalOrderStatus" "OrderStatus" NOT NULL, "reason" TEXT NOT NULL, "evidences" JSONB NOT NULL DEFAULT '[]', "resolution" TEXT,
 "fundingSource" TEXT, "refundAmount" INTEGER NOT NULL DEFAULT 0 CHECK ("refundAmount" >= 0), "codAmount" INTEGER NOT NULL DEFAULT 0 CHECK ("codAmount" >= 0),
 "codReference" TEXT, "codRefundedAt" TIMESTAMP(3), "codConfirmedAt" TIMESTAMP(3), "trackingCode" TEXT, "receivedNote" TEXT,
 "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "approvedAt" TIMESTAMP(3), "shippedAt" TIMESTAMP(3),
 "receivedAt" TIMESTAMP(3), "refundedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ReturnRequest_status_requestedAt_idx" ON "ReturnRequest"("status","requestedAt");
CREATE TABLE "ActionQuota" ("userId" INTEGER NOT NULL, "action" TEXT NOT NULL, "windowStart" TIMESTAMP(3) NOT NULL, "count" INTEGER NOT NULL DEFAULT 0, PRIMARY KEY ("userId","action","windowStart"));
CREATE INDEX "ActionQuota_windowStart_idx" ON "ActionQuota"("windowStart");
CREATE TABLE "UserBlock" ("blockerId" INTEGER NOT NULL, "blockedId" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY ("blockerId","blockedId"));
COMMIT;
