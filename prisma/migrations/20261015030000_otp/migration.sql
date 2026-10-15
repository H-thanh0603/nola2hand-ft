-- OTP 6 số cho xác nhận email và đặt lại mật khẩu (chạy song song link cũ)
ALTER TABLE "User" ADD COLUMN "emailOtpHash" TEXT,
  ADD COLUMN "emailOtpExpiresAt" TIMESTAMP(3),
  ADD COLUMN "emailOtpAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "passwordOtpHash" TEXT,
  ADD COLUMN "passwordOtpExpiresAt" TIMESTAMP(3),
  ADD COLUMN "passwordOtpAttempts" INTEGER NOT NULL DEFAULT 0;
