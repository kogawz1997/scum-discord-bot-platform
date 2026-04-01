CREATE TABLE IF NOT EXISTS "platform_raid_requests" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tenant_id" TEXT,
  "requester_user_id" TEXT NOT NULL,
  "requester_name" TEXT NOT NULL,
  "request_text" TEXT NOT NULL,
  "preferred_window" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "decision_note" TEXT,
  "reviewed_by" TEXT,
  "reviewed_at" DATETIME,
  "server_id" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "platform_raid_windows" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tenant_id" TEXT,
  "request_id" INTEGER,
  "title" TEXT NOT NULL,
  "starts_at" DATETIME NOT NULL,
  "ends_at" DATETIME,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "notes" TEXT,
  "actor" TEXT,
  "server_id" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "platform_raid_summaries" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tenant_id" TEXT,
  "request_id" INTEGER,
  "window_id" INTEGER,
  "outcome" TEXT NOT NULL,
  "notes" TEXT,
  "created_by" TEXT,
  "server_id" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "platform_raid_requests_tenant_id_status_updated_at_idx"
ON "platform_raid_requests"("tenant_id", "status", "updated_at");
CREATE INDEX IF NOT EXISTS "platform_raid_requests_tenant_id_requester_user_id_updated_at_idx"
ON "platform_raid_requests"("tenant_id", "requester_user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "platform_raid_requests_tenant_id_server_id_updated_at_idx"
ON "platform_raid_requests"("tenant_id", "server_id", "updated_at");

CREATE INDEX IF NOT EXISTS "platform_raid_windows_tenant_id_status_starts_at_idx"
ON "platform_raid_windows"("tenant_id", "status", "starts_at");
CREATE INDEX IF NOT EXISTS "platform_raid_windows_tenant_id_server_id_starts_at_idx"
ON "platform_raid_windows"("tenant_id", "server_id", "starts_at");
CREATE INDEX IF NOT EXISTS "platform_raid_windows_request_id_starts_at_idx"
ON "platform_raid_windows"("request_id", "starts_at");

CREATE INDEX IF NOT EXISTS "platform_raid_summaries_tenant_id_created_at_idx"
ON "platform_raid_summaries"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "platform_raid_summaries_tenant_id_server_id_created_at_idx"
ON "platform_raid_summaries"("tenant_id", "server_id", "created_at");
CREATE INDEX IF NOT EXISTS "platform_raid_summaries_request_id_created_at_idx"
ON "platform_raid_summaries"("request_id", "created_at");
CREATE INDEX IF NOT EXISTS "platform_raid_summaries_window_id_created_at_idx"
ON "platform_raid_summaries"("window_id", "created_at");
