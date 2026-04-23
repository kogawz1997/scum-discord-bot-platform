-- Add platform state persistence tables and control-plane registry tables.
-- These tables are intentionally idempotent so platform-schema-upgrade can
-- apply them safely on existing installations without requiring a full
-- migrate deploy flow.

CREATE TABLE IF NOT EXISTS "PlatformPreviewAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT,
  "communityName" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "packageId" TEXT NOT NULL DEFAULT 'BOT_LOG_DELIVERY',
  "accountState" TEXT NOT NULL DEFAULT 'preview',
  "verificationState" TEXT NOT NULL DEFAULT 'registered',
  "tenantId" TEXT,
  "subscriptionId" TEXT,
  "linkedIdentitiesJson" TEXT,
  "lastLoginAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformPreviewAccount_email_key"
  ON "PlatformPreviewAccount"("email");
CREATE INDEX IF NOT EXISTS "PlatformPreviewAccount_accountState_updatedAt_idx"
  ON "PlatformPreviewAccount"("accountState", "updatedAt");
CREATE INDEX IF NOT EXISTS "PlatformPreviewAccount_tenantId_updatedAt_idx"
  ON "PlatformPreviewAccount"("tenantId", "updatedAt");
CREATE INDEX IF NOT EXISTS "PlatformPreviewAccount_subscriptionId_updatedAt_idx"
  ON "PlatformPreviewAccount"("subscriptionId", "updatedAt");

CREATE TABLE IF NOT EXISTS "PlatformAdminNotification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL DEFAULT 'notice',
  "source" TEXT NOT NULL DEFAULT 'system',
  "kind" TEXT NOT NULL DEFAULT 'notice',
  "severity" TEXT NOT NULL DEFAULT 'info',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "entityKey" TEXT,
  "dataJson" TEXT,
  "acknowledgedAt" DATETIME,
  "acknowledgedBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PlatformAdminNotification_createdAt_idx"
  ON "PlatformAdminNotification"("createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAdminNotification_severity_createdAt_idx"
  ON "PlatformAdminNotification"("severity", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAdminNotification_kind_createdAt_idx"
  ON "PlatformAdminNotification"("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAdminNotification_entityKey_createdAt_idx"
  ON "PlatformAdminNotification"("entityKey", "createdAt");
CREATE INDEX IF NOT EXISTS "PlatformAdminNotification_acknowledgedAt_createdAt_idx"
  ON "PlatformAdminNotification"("acknowledgedAt", "createdAt");

CREATE TABLE IF NOT EXISTS "PlatformAdminSecurityEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "type" TEXT NOT NULL DEFAULT 'security-event',
  "severity" TEXT NOT NULL DEFAULT 'info',
  "actor" TEXT,
  "targetUser" TEXT,
  "role" TEXT,
  "authMethod" TEXT,
  "sessionId" TEXT,
  "ip" TEXT,
  "path" TEXT,
  "reason" TEXT,
  "detail" TEXT,
  "dataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PlatformAdminSecurityEvent_occurredAt_idx"
  ON "PlatformAdminSecurityEvent"("occurredAt");
CREATE INDEX IF NOT EXISTS "PlatformAdminSecurityEvent_severity_occurredAt_idx"
  ON "PlatformAdminSecurityEvent"("severity", "occurredAt");
CREATE INDEX IF NOT EXISTS "PlatformAdminSecurityEvent_type_occurredAt_idx"
  ON "PlatformAdminSecurityEvent"("type", "occurredAt");
CREATE INDEX IF NOT EXISTS "PlatformAdminSecurityEvent_sessionId_occurredAt_idx"
  ON "PlatformAdminSecurityEvent"("sessionId", "occurredAt");

CREATE TABLE IF NOT EXISTS "PlatformAutomationState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "lastAutomationAt" DATETIME,
  "lastForcedMonitoringAt" DATETIME,
  "lastRecoveryAtByKeyJson" TEXT,
  "recoveryWindowStartedAtByKeyJson" TEXT,
  "recoveryAttemptsByKeyJson" TEXT,
  "lastRecoveryResultByKeyJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PlatformAutomationState_updatedAt_idx"
  ON "PlatformAutomationState"("updatedAt");

CREATE TABLE IF NOT EXISTS "PlatformOpsState" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "lastMonitoringAt" DATETIME,
  "lastAutoBackupAt" DATETIME,
  "lastReconcileAt" DATETIME,
  "lastAlertAtByKeyJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "PlatformOpsState_updatedAt_idx"
  ON "PlatformOpsState"("updatedAt");

CREATE TABLE IF NOT EXISTS "ControlPlaneServer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "slug" TEXT,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "locale" TEXT NOT NULL DEFAULT 'th',
  "guildId" TEXT,
  "metadataJson" TEXT,
  "actor" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ControlPlaneServer_tenantId_updatedAt_idx"
  ON "ControlPlaneServer"("tenantId", "updatedAt");
CREATE INDEX IF NOT EXISTS "ControlPlaneServer_tenantId_guildId_idx"
  ON "ControlPlaneServer"("tenantId", "guildId");
CREATE INDEX IF NOT EXISTS "ControlPlaneServer_tenantId_slug_idx"
  ON "ControlPlaneServer"("tenantId", "slug");

CREATE TABLE IF NOT EXISTS "ControlPlaneServerDiscordLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "guildId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadataJson" TEXT,
  "actor" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ControlPlaneServerDiscordLink_tenantId_guildId_key"
  ON "ControlPlaneServerDiscordLink"("tenantId", "guildId");
CREATE INDEX IF NOT EXISTS "ControlPlaneServerDiscordLink_tenantId_serverId_updatedAt_idx"
  ON "ControlPlaneServerDiscordLink"("tenantId", "serverId", "updatedAt");

CREATE TABLE IF NOT EXISTS "ControlPlaneAgent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "guildId" TEXT,
  "agentId" TEXT NOT NULL,
  "runtimeKey" TEXT NOT NULL,
  "displayName" TEXT,
  "role" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "channel" TEXT,
  "version" TEXT,
  "minimumVersion" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "baseUrl" TEXT,
  "hostname" TEXT,
  "metadataJson" TEXT,
  "actor" TEXT,
  "lastSeenAt" DATETIME,
  "lastSyncAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ControlPlaneAgent_tenantId_serverId_agentId_key"
  ON "ControlPlaneAgent"("tenantId", "serverId", "agentId");
CREATE INDEX IF NOT EXISTS "ControlPlaneAgent_tenantId_serverId_runtimeKey_idx"
  ON "ControlPlaneAgent"("tenantId", "serverId", "runtimeKey");
CREATE INDEX IF NOT EXISTS "ControlPlaneAgent_status_updatedAt_idx"
  ON "ControlPlaneAgent"("status", "updatedAt");

CREATE TABLE IF NOT EXISTS "ControlPlaneAgentTokenBinding" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "guildId" TEXT,
  "agentId" TEXT NOT NULL,
  "apiKeyId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "minVersion" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "actor" TEXT,
  "revokedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ControlPlaneAgentTokenBinding_apiKeyId_key"
  ON "ControlPlaneAgentTokenBinding"("apiKeyId");
CREATE INDEX IF NOT EXISTS "ControlPlaneAgentTokenBinding_tenantId_serverId_agentId_updatedAt_idx"
  ON "ControlPlaneAgentTokenBinding"("tenantId", "serverId", "agentId", "updatedAt");
CREATE INDEX IF NOT EXISTS "ControlPlaneAgentTokenBinding_status_updatedAt_idx"
  ON "ControlPlaneAgentTokenBinding"("status", "updatedAt");

CREATE TABLE IF NOT EXISTS "ControlPlaneAgentProvisioningToken" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "guildId" TEXT,
  "agentId" TEXT NOT NULL,
  "runtimeKey" TEXT,
  "role" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending_activation',
  "tokenPrefix" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "minVersion" TEXT,
  "expiresAt" DATETIME,
  "consumedAt" DATETIME,
  "revokedAt" DATETIME,
  "activatedDeviceId" TEXT,
  "activatedCredentialId" TEXT,
  "metadataJson" TEXT,
  "actor" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ControlPlaneAgentProvisioningToken_tokenPrefix_key"
  ON "ControlPlaneAgentProvisioningToken"("tokenPrefix");
CREATE INDEX IF NOT EXISTS "ControlPlaneAgentProvisioningToken_tenantId_serverId_agentId_updatedAt_idx"
  ON "ControlPlaneAgentProvisioningToken"("tenantId", "serverId", "agentId", "updatedAt");
CREATE INDEX IF NOT EXISTS "ControlPlaneAgentProvisioningToken_status_expiresAt_idx"
  ON "ControlPlaneAgentProvisioningToken"("status", "expiresAt");

CREATE TABLE IF NOT EXISTS "ControlPlaneAgentDevice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "guildId" TEXT,
  "agentId" TEXT NOT NULL,
  "runtimeKey" TEXT,
  "machineFingerprintHash" TEXT NOT NULL,
  "hostname" TEXT,
  "status" TEXT NOT NULL DEFAULT 'online',
  "credentialId" TEXT,
  "metadataJson" TEXT,
  "actor" TEXT,
  "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ControlPlaneAgentDevice_tenantId_serverId_agentId_updatedAt_idx"
  ON "ControlPlaneAgentDevice"("tenantId", "serverId", "agentId", "updatedAt");
CREATE INDEX IF NOT EXISTS "ControlPlaneAgentDevice_status_lastSeenAt_idx"
  ON "ControlPlaneAgentDevice"("status", "lastSeenAt");

CREATE TABLE IF NOT EXISTS "ControlPlaneAgentCredential" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "guildId" TEXT,
  "agentId" TEXT NOT NULL,
  "apiKeyId" TEXT NOT NULL,
  "keyPrefix" TEXT,
  "role" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "minVersion" TEXT,
  "deviceId" TEXT,
  "lastIssuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastRotatedAt" DATETIME,
  "revokedAt" DATETIME,
  "metadataJson" TEXT,
  "actor" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ControlPlaneAgentCredential_apiKeyId_key"
  ON "ControlPlaneAgentCredential"("apiKeyId");
CREATE INDEX IF NOT EXISTS "ControlPlaneAgentCredential_tenantId_serverId_agentId_updatedAt_idx"
  ON "ControlPlaneAgentCredential"("tenantId", "serverId", "agentId", "updatedAt");
CREATE INDEX IF NOT EXISTS "ControlPlaneAgentCredential_status_updatedAt_idx"
  ON "ControlPlaneAgentCredential"("status", "updatedAt");

CREATE TABLE IF NOT EXISTS "ControlPlaneAgentSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "guildId" TEXT,
  "agentId" TEXT NOT NULL,
  "runtimeKey" TEXT NOT NULL,
  "displayName" TEXT,
  "role" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "channel" TEXT,
  "version" TEXT,
  "minimumVersion" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "baseUrl" TEXT,
  "hostname" TEXT,
  "metadataJson" TEXT,
  "diagnosticsJson" TEXT,
  "sessionId" TEXT NOT NULL,
  "heartbeatAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT NOT NULL DEFAULT 'agent',
  "actor" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ControlPlaneAgentSession_sessionId_key"
  ON "ControlPlaneAgentSession"("sessionId");
CREATE INDEX IF NOT EXISTS "ControlPlaneAgentSession_tenantId_serverId_agentId_heartbeatAt_idx"
  ON "ControlPlaneAgentSession"("tenantId", "serverId", "agentId", "heartbeatAt");
CREATE INDEX IF NOT EXISTS "ControlPlaneAgentSession_heartbeatAt_idx"
  ON "ControlPlaneAgentSession"("heartbeatAt");

CREATE TABLE IF NOT EXISTS "ControlPlaneSyncRun" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "guildId" TEXT,
  "agentId" TEXT NOT NULL,
  "runtimeKey" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL DEFAULT 'log',
  "sourcePath" TEXT,
  "version" TEXT,
  "freshnessAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "eventCount" INTEGER NOT NULL DEFAULT 0,
  "errorsJson" TEXT,
  "snapshotJson" TEXT,
  "actor" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ControlPlaneSyncRun_tenantId_serverId_agentId_updatedAt_idx"
  ON "ControlPlaneSyncRun"("tenantId", "serverId", "agentId", "updatedAt");
CREATE INDEX IF NOT EXISTS "ControlPlaneSyncRun_freshnessAt_idx"
  ON "ControlPlaneSyncRun"("freshnessAt");

CREATE TABLE IF NOT EXISTS "ControlPlaneSyncEvent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "syncRunId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "serverId" TEXT NOT NULL,
  "guildId" TEXT,
  "agentId" TEXT NOT NULL,
  "runtimeKey" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'event',
  "summary" TEXT,
  "payloadJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ControlPlaneSyncEvent_syncRunId_createdAt_idx"
  ON "ControlPlaneSyncEvent"("syncRunId", "createdAt");
CREATE INDEX IF NOT EXISTS "ControlPlaneSyncEvent_tenantId_serverId_agentId_createdAt_idx"
  ON "ControlPlaneSyncEvent"("tenantId", "serverId", "agentId", "createdAt");
