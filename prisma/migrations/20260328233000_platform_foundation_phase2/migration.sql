CREATE TABLE IF NOT EXISTS "platform_users" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "primaryEmail" TEXT,
  "displayName" TEXT,
  "passwordHash" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_users_primaryEmail_key" ON "platform_users"("primaryEmail");
CREATE INDEX IF NOT EXISTS "platform_users_status_updatedAt_idx" ON "platform_users"("status", "updatedAt");

CREATE TABLE IF NOT EXISTS "platform_user_identities" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerUserId" TEXT NOT NULL,
  "providerEmail" TEXT,
  "displayName" TEXT,
  "avatarUrl" TEXT,
  "verifiedAt" DATETIME,
  "linkedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_user_identities_provider_providerUserId_key" ON "platform_user_identities"("provider", "providerUserId");
CREATE INDEX IF NOT EXISTS "platform_user_identities_userId_linkedAt_idx" ON "platform_user_identities"("userId", "linkedAt");
CREATE INDEX IF NOT EXISTS "platform_user_identities_provider_providerEmail_idx" ON "platform_user_identities"("provider", "providerEmail");

CREATE TABLE IF NOT EXISTS "platform_memberships" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT,
  "membershipType" TEXT NOT NULL DEFAULT 'tenant',
  "role" TEXT NOT NULL DEFAULT 'member',
  "status" TEXT NOT NULL DEFAULT 'active',
  "isPrimary" BOOLEAN NOT NULL DEFAULT 0,
  "invitedAt" DATETIME,
  "acceptedAt" DATETIME,
  "revokedAt" DATETIME,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "platform_memberships_userId_updatedAt_idx" ON "platform_memberships"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "platform_memberships_tenantId_role_updatedAt_idx" ON "platform_memberships"("tenantId", "role", "updatedAt");
CREATE INDEX IF NOT EXISTS "platform_memberships_status_updatedAt_idx" ON "platform_memberships"("status", "updatedAt");

CREATE TABLE IF NOT EXISTS "platform_player_profiles" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT,
  "discordUserId" TEXT,
  "steamId" TEXT,
  "inGameName" TEXT,
  "verificationState" TEXT NOT NULL DEFAULT 'unverified',
  "linkedAt" DATETIME,
  "lastSeenAt" DATETIME,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "platform_player_profiles_userId_updatedAt_idx" ON "platform_player_profiles"("userId", "updatedAt");
CREATE INDEX IF NOT EXISTS "platform_player_profiles_tenantId_steamId_idx" ON "platform_player_profiles"("tenantId", "steamId");
CREATE INDEX IF NOT EXISTS "platform_player_profiles_tenantId_discordUserId_idx" ON "platform_player_profiles"("tenantId", "discordUserId");
CREATE INDEX IF NOT EXISTS "platform_player_profiles_verificationState_updatedAt_idx" ON "platform_player_profiles"("verificationState", "updatedAt");

CREATE TABLE IF NOT EXISTS "platform_verification_tokens" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "previewAccountId" TEXT,
  "purpose" TEXT NOT NULL DEFAULT 'email_verification',
  "tokenType" TEXT,
  "tokenPrefix" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "email" TEXT,
  "target" TEXT,
  "expiresAt" DATETIME NOT NULL,
  "consumedAt" DATETIME,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_verification_tokens_type_hash_key" ON "platform_verification_tokens"("tokenType", "tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "platform_verification_tokens_email_hash_key" ON "platform_verification_tokens"("email", "tokenHash");
CREATE INDEX IF NOT EXISTS "platform_verification_tokens_preview_exp_idx" ON "platform_verification_tokens"("previewAccountId", "expiresAt");
CREATE INDEX IF NOT EXISTS "platform_verification_tokens_user_purpose_exp_idx" ON "platform_verification_tokens"("userId", "purpose", "expiresAt");
CREATE INDEX IF NOT EXISTS "platform_verification_tokens_email_purpose_exp_idx" ON "platform_verification_tokens"("email", "purpose", "expiresAt");
CREATE INDEX IF NOT EXISTS "platform_verification_tokens_user_type_exp_idx" ON "platform_verification_tokens"("userId", "tokenType", "expiresAt");
CREATE INDEX IF NOT EXISTS "platform_verification_tokens_email_type_exp_idx" ON "platform_verification_tokens"("email", "tokenType", "expiresAt");
CREATE INDEX IF NOT EXISTS "platform_verification_tokens_consumed_exp_idx" ON "platform_verification_tokens"("consumedAt", "expiresAt");

CREATE TABLE IF NOT EXISTS "platform_password_reset_tokens" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT,
  "previewAccountId" TEXT,
  "email" TEXT NOT NULL,
  "tokenPrefix" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "consumedAt" DATETIME,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_password_reset_tokens_email_hash_key" ON "platform_password_reset_tokens"("email", "tokenHash");
CREATE INDEX IF NOT EXISTS "platform_password_reset_tokens_user_exp_idx" ON "platform_password_reset_tokens"("userId", "expiresAt");
CREATE INDEX IF NOT EXISTS "platform_password_reset_tokens_preview_exp_idx" ON "platform_password_reset_tokens"("previewAccountId", "expiresAt");
CREATE INDEX IF NOT EXISTS "platform_password_reset_tokens_consumed_exp_idx" ON "platform_password_reset_tokens"("consumedAt", "expiresAt");

CREATE TABLE IF NOT EXISTS "platform_billing_customers" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT,
  "displayName" TEXT,
  "externalRef" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_billing_customers_tenantId_key" ON "platform_billing_customers"("tenantId");
CREATE INDEX IF NOT EXISTS "platform_billing_customers_status_updatedAt_idx" ON "platform_billing_customers"("status", "updatedAt");
CREATE INDEX IF NOT EXISTS "platform_billing_customers_userId_updatedAt_idx" ON "platform_billing_customers"("userId", "updatedAt");

CREATE TABLE IF NOT EXISTS "platform_billing_invoices" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "customerId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "currency" TEXT NOT NULL DEFAULT 'THB',
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "dueAt" DATETIME,
  "paidAt" DATETIME,
  "externalRef" TEXT,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "platform_billing_invoices_tenant_createdAt_idx" ON "platform_billing_invoices"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "platform_billing_invoices_subscription_status_updatedAt_idx" ON "platform_billing_invoices"("subscriptionId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "platform_billing_invoices_customer_status_updatedAt_idx" ON "platform_billing_invoices"("customerId", "status", "updatedAt");

CREATE TABLE IF NOT EXISTS "platform_billing_payment_attempts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "invoiceId" TEXT,
  "tenantId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'THB',
  "externalRef" TEXT,
  "errorCode" TEXT,
  "errorDetail" TEXT,
  "attemptedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME,
  "metadataJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "platform_billing_payment_attempts_tenant_attemptedAt_idx" ON "platform_billing_payment_attempts"("tenantId", "attemptedAt");
CREATE INDEX IF NOT EXISTS "platform_billing_payment_attempts_invoice_status_attemptedAt_idx" ON "platform_billing_payment_attempts"("invoiceId", "status", "attemptedAt");
CREATE INDEX IF NOT EXISTS "platform_billing_payment_attempts_provider_status_attemptedAt_idx" ON "platform_billing_payment_attempts"("provider", "status", "attemptedAt");

CREATE TABLE IF NOT EXISTS "platform_subscription_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "billingStatus" TEXT,
  "actor" TEXT,
  "payloadJson" TEXT,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "platform_subscription_events_tenant_occurredAt_idx" ON "platform_subscription_events"("tenantId", "occurredAt");
CREATE INDEX IF NOT EXISTS "platform_subscription_events_subscription_occurredAt_idx" ON "platform_subscription_events"("subscriptionId", "occurredAt");
CREATE INDEX IF NOT EXISTS "platform_subscription_events_type_occurredAt_idx" ON "platform_subscription_events"("eventType", "occurredAt");

CREATE TABLE IF NOT EXISTS "platform_tenant_configs" (
  "tenant_id" TEXT NOT NULL PRIMARY KEY,
  "config_patch_json" TEXT,
  "portal_env_patch_json" TEXT,
  "feature_flags_json" TEXT,
  "updated_by" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "platform_tenant_configs_updated_at_idx" ON "platform_tenant_configs"("updated_at");

CREATE TABLE IF NOT EXISTS "platform_server_config_snapshots" (
  "server_id" TEXT NOT NULL PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "runtime_key" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ready',
  "snapshot_json" TEXT NOT NULL,
  "collected_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by" TEXT,
  "last_job_id" TEXT,
  "last_error" TEXT,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "platform_server_config_snapshots_tenant_updated_idx" ON "platform_server_config_snapshots"("tenant_id", "updated_at");
CREATE INDEX IF NOT EXISTS "platform_server_config_snapshots_runtime_updated_idx" ON "platform_server_config_snapshots"("runtime_key", "updated_at");

CREATE TABLE IF NOT EXISTS "platform_server_config_jobs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "server_id" TEXT NOT NULL,
  "job_type" TEXT NOT NULL DEFAULT 'config_update',
  "apply_mode" TEXT NOT NULL DEFAULT 'save_only',
  "status" TEXT NOT NULL DEFAULT 'queued',
  "requested_by" TEXT,
  "requested_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "claimed_by_runtime_key" TEXT,
  "claimed_at" DATETIME,
  "completed_at" DATETIME,
  "changes_json" TEXT,
  "result_json" TEXT,
  "error_text" TEXT,
  "meta_json" TEXT
);

CREATE INDEX IF NOT EXISTS "platform_server_config_jobs_tenant_server_requested_idx" ON "platform_server_config_jobs"("tenant_id", "server_id", "requested_at");
CREATE INDEX IF NOT EXISTS "platform_server_config_jobs_status_requested_idx" ON "platform_server_config_jobs"("status", "requested_at");

CREATE TABLE IF NOT EXISTS "platform_server_config_backups" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "server_id" TEXT NOT NULL,
  "job_id" TEXT,
  "file_name" TEXT NOT NULL,
  "backup_path" TEXT,
  "changed_by" TEXT,
  "change_summary_json" TEXT,
  "meta_json" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "platform_server_config_backups_tenant_server_created_idx" ON "platform_server_config_backups"("tenant_id", "server_id", "created_at");
CREATE INDEX IF NOT EXISTS "platform_server_config_backups_job_created_idx" ON "platform_server_config_backups"("job_id", "created_at");

CREATE TABLE IF NOT EXISTS "platform_restart_plans" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenant_id" TEXT NOT NULL,
  "server_id" TEXT NOT NULL,
  "guild_id" TEXT,
  "runtime_key" TEXT,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "restart_mode" TEXT NOT NULL DEFAULT 'delayed',
  "control_mode" TEXT NOT NULL DEFAULT 'service',
  "requested_by" TEXT,
  "scheduled_for" DATETIME NOT NULL,
  "delay_seconds" INTEGER NOT NULL DEFAULT 0,
  "reason" TEXT,
  "payload_json" TEXT,
  "health_status" TEXT,
  "health_verified_at" DATETIME,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "platform_restart_plans_tenant_scheduled_idx" ON "platform_restart_plans"("tenant_id", "scheduled_for");
CREATE INDEX IF NOT EXISTS "platform_restart_plans_server_scheduled_idx" ON "platform_restart_plans"("server_id", "scheduled_for");
CREATE INDEX IF NOT EXISTS "platform_restart_plans_status_scheduled_idx" ON "platform_restart_plans"("status", "scheduled_for");

CREATE TABLE IF NOT EXISTS "platform_restart_announcements" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "plan_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "server_id" TEXT NOT NULL,
  "checkpoint_seconds" INTEGER NOT NULL,
  "message" TEXT NOT NULL,
  "channel" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "scheduled_for" DATETIME NOT NULL,
  "sent_at" DATETIME,
  "meta_json" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "platform_restart_announcements_plan_scheduled_idx" ON "platform_restart_announcements"("plan_id", "scheduled_for");
CREATE INDEX IF NOT EXISTS "platform_restart_announcements_status_scheduled_idx" ON "platform_restart_announcements"("status", "scheduled_for");

CREATE TABLE IF NOT EXISTS "platform_restart_executions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "plan_id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "server_id" TEXT NOT NULL,
  "runtime_key" TEXT,
  "action" TEXT NOT NULL DEFAULT 'restart',
  "result_status" TEXT NOT NULL DEFAULT 'pending',
  "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" DATETIME,
  "exit_code" INTEGER,
  "detail" TEXT,
  "meta_json" TEXT,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "platform_restart_executions_plan_started_idx" ON "platform_restart_executions"("plan_id", "started_at");
CREATE INDEX IF NOT EXISTS "platform_restart_executions_tenant_server_started_idx" ON "platform_restart_executions"("tenant_id", "server_id", "started_at");
