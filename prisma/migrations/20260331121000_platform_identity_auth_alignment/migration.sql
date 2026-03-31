ALTER TABLE "platform_users" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;

ALTER TABLE "platform_verification_tokens" ADD COLUMN IF NOT EXISTS "previewAccountId" TEXT;
ALTER TABLE "platform_verification_tokens" ADD COLUMN IF NOT EXISTS "purpose" TEXT DEFAULT 'email_verification';
ALTER TABLE "platform_verification_tokens" ADD COLUMN IF NOT EXISTS "tokenType" TEXT;
ALTER TABLE "platform_verification_tokens" ADD COLUMN IF NOT EXISTS "target" TEXT;

UPDATE "platform_verification_tokens"
SET "purpose" = COALESCE(NULLIF("purpose", ''), NULLIF("tokenType", ''), 'email_verification')
WHERE "purpose" IS NULL OR "purpose" = '';

UPDATE "platform_verification_tokens"
SET "tokenType" = COALESCE(NULLIF("tokenType", ''), NULLIF("purpose", ''), 'email_verification')
WHERE "tokenType" IS NULL OR "tokenType" = '';

UPDATE "platform_verification_tokens"
SET "target" = COALESCE(NULLIF("target", ''), "email")
WHERE ("target" IS NULL OR "target" = '')
  AND "email" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "platform_verification_tokens_email_hash_key" ON "platform_verification_tokens"("email", "tokenHash");
CREATE INDEX IF NOT EXISTS "platform_verification_tokens_preview_exp_idx" ON "platform_verification_tokens"("previewAccountId", "expiresAt");
CREATE INDEX IF NOT EXISTS "platform_verification_tokens_user_purpose_exp_idx" ON "platform_verification_tokens"("userId", "purpose", "expiresAt");
CREATE INDEX IF NOT EXISTS "platform_verification_tokens_email_purpose_exp_idx" ON "platform_verification_tokens"("email", "purpose", "expiresAt");
