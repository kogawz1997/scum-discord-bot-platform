CREATE TABLE IF NOT EXISTS "kill_feed_events" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "tenantId" TEXT,
  "serverId" TEXT,
  "killerName" TEXT NOT NULL,
  "killerSteamId" TEXT,
  "killerUserId" TEXT,
  "victimName" TEXT NOT NULL,
  "victimSteamId" TEXT,
  "victimUserId" TEXT,
  "weapon" TEXT NOT NULL,
  "distance" INTEGER,
  "hitZone" TEXT,
  "sector" TEXT,
  "mapImageUrl" TEXT,
  "metadataJson" TEXT,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "kill_feed_events_tenantId_occurredAt_idx" ON "kill_feed_events"("tenantId", "occurredAt");
CREATE INDEX IF NOT EXISTS "kill_feed_events_tenantId_serverId_occurredAt_idx" ON "kill_feed_events"("tenantId", "serverId", "occurredAt");
CREATE INDEX IF NOT EXISTS "kill_feed_events_killerUserId_occurredAt_idx" ON "kill_feed_events"("killerUserId", "occurredAt");
CREATE INDEX IF NOT EXISTS "kill_feed_events_victimUserId_occurredAt_idx" ON "kill_feed_events"("victimUserId", "occurredAt");
