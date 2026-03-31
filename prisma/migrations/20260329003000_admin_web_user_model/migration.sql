CREATE TABLE IF NOT EXISTS "admin_web_users" (
  "username" TEXT NOT NULL PRIMARY KEY,
  "password_hash" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'mod',
  "tenant_id" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT 1,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "admin_web_users_role_is_active_idx" ON "admin_web_users"("role", "is_active");
CREATE INDEX IF NOT EXISTS "admin_web_users_tenant_id_role_idx" ON "admin_web_users"("tenant_id", "role");
