CREATE TABLE IF NOT EXISTS "PlatformAdminRequestLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "path" TEXT NOT NULL,
    "routeGroup" TEXT NOT NULL DEFAULT 'unknown',
    "statusCode" INTEGER NOT NULL DEFAULT 0,
    "statusClass" TEXT NOT NULL DEFAULT 'other',
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL DEFAULT false,
    "authMode" TEXT,
    "user" TEXT,
    "role" TEXT,
    "tenantId" TEXT,
    "ip" TEXT,
    "origin" TEXT,
    "userAgent" TEXT,
    "source" TEXT,
    "note" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PlatformAdminRestoreState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "maintenance" BOOLEAN NOT NULL DEFAULT false,
    "operationId" TEXT,
    "backup" TEXT,
    "confirmBackup" TEXT,
    "rollbackBackup" TEXT,
    "actor" TEXT,
    "role" TEXT,
    "note" TEXT,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "lastCompletedAt" DATETIME,
    "durationMs" INTEGER,
    "lastError" TEXT,
    "rollbackStatus" TEXT NOT NULL DEFAULT 'none',
    "rollbackError" TEXT,
    "countsJson" TEXT,
    "currentCountsJson" TEXT,
    "diffJson" TEXT,
    "warningsJson" TEXT,
    "verificationJson" TEXT,
    "previewToken" TEXT,
    "previewBackup" TEXT,
    "previewIssuedAt" DATETIME,
    "previewExpiresAt" DATETIME,
    "historyJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PlatformAdminRequestLog_occurredAt_idx" ON "PlatformAdminRequestLog"("occurredAt");

CREATE INDEX IF NOT EXISTS "PlatformAdminRequestLog_routeGroup_occurredAt_idx" ON "PlatformAdminRequestLog"("routeGroup", "occurredAt");

CREATE INDEX IF NOT EXISTS "PlatformAdminRequestLog_tenantId_occurredAt_idx" ON "PlatformAdminRequestLog"("tenantId", "occurredAt");

CREATE INDEX IF NOT EXISTS "PlatformAdminRequestLog_statusCode_occurredAt_idx" ON "PlatformAdminRequestLog"("statusCode", "occurredAt");

CREATE INDEX IF NOT EXISTS "PlatformAdminRestoreState_updatedAt_idx" ON "PlatformAdminRestoreState"("updatedAt");

CREATE INDEX IF NOT EXISTS "PlatformAdminRestoreState_status_updatedAt_idx" ON "PlatformAdminRestoreState"("status", "updatedAt");
