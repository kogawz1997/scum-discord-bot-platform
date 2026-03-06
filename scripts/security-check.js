require('dotenv').config();

function isTruthy(value) {
  const text = String(value || '').trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'yes' || text === 'on';
}

function isLikelyPlaceholder(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return true;
  const patterns = [
    'your_',
    'example',
    'changeme',
    'replace',
    'token_here',
    'password_here',
    'ใส่',
  ];
  return patterns.some((pattern) => text.includes(pattern));
}

function isLocalHost(host) {
  const value = String(host || '').trim().toLowerCase();
  return value === '127.0.0.1' || value === 'localhost' || value === '::1';
}

function checkMinLength(name, value, minLength, errors, warnings) {
  const text = String(value || '');
  if (!text.trim()) {
    errors.push(`${name} is missing`);
    return;
  }
  if (text.length < minLength) {
    warnings.push(`${name} should be at least ${minLength} chars (current=${text.length})`);
  }
}

function run() {
  const env = process.env;
  const errors = [];
  const warnings = [];

  if (!env.DISCORD_TOKEN || isLikelyPlaceholder(env.DISCORD_TOKEN)) {
    errors.push('DISCORD_TOKEN is missing or placeholder');
  }

  checkMinLength('SCUM_WEBHOOK_SECRET', env.SCUM_WEBHOOK_SECRET, 24, errors, warnings);
  checkMinLength('ADMIN_WEB_PASSWORD', env.ADMIN_WEB_PASSWORD, 12, errors, warnings);
  checkMinLength('ADMIN_WEB_TOKEN', env.ADMIN_WEB_TOKEN, 24, errors, warnings);

  if (String(env.ADMIN_WEB_ALLOW_TOKEN_QUERY || '').trim().toLowerCase() !== 'false') {
    warnings.push('ADMIN_WEB_ALLOW_TOKEN_QUERY should be false in production');
  }

  if (!isTruthy(env.ADMIN_WEB_ENFORCE_ORIGIN_CHECK)) {
    warnings.push('ADMIN_WEB_ENFORCE_ORIGIN_CHECK should be true');
  }

  if (!String(env.ADMIN_WEB_ALLOWED_ORIGINS || '').trim()) {
    warnings.push('ADMIN_WEB_ALLOWED_ORIGINS is empty; set explicit allowed origins');
  }

  const host = String(env.ADMIN_WEB_HOST || '').trim();
  if (host && !isLocalHost(host) && !isTruthy(env.ADMIN_WEB_SECURE_COOKIE)) {
    warnings.push('ADMIN_WEB_SECURE_COOKIE should be true when ADMIN_WEB_HOST is non-local');
  }

  if (isTruthy(env.ADMIN_WEB_SECURE_COOKIE) && !isTruthy(env.ADMIN_WEB_HSTS_ENABLED)) {
    warnings.push('ADMIN_WEB_HSTS_ENABLED should be true when using secure cookies behind HTTPS');
  }

  const rconExecTemplate = String(env.RCON_EXEC_TEMPLATE || '').trim();
  if (rconExecTemplate.includes('{password}') && !String(env.RCON_PASSWORD || '').trim()) {
    warnings.push('RCON_PASSWORD is empty while RCON_EXEC_TEMPLATE uses {password}');
  }

  if (!String(env.DATABASE_URL || '').trim()) {
    errors.push('DATABASE_URL is missing');
  }

  if (errors.length > 0) {
    console.error('SECURITY_CHECK: FAILED');
    for (const line of errors) {
      console.error(`ERROR: ${line}`);
    }
    for (const line of warnings) {
      console.error(`WARN: ${line}`);
    }
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.warn('SECURITY_CHECK: PASSED with warnings');
    for (const line of warnings) {
      console.warn(`WARN: ${line}`);
    }
  } else {
    console.log('SECURITY_CHECK: PASSED');
  }
}

run();
