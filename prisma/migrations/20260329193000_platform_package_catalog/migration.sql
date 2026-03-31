CREATE TABLE IF NOT EXISTS "PlatformPackageCatalogEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "featuresJson" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" TEXT,
    "actor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PlatformPackageCatalogEntry_status_position_updatedAt_idx"
ON "PlatformPackageCatalogEntry"("status", "position", "updatedAt");
