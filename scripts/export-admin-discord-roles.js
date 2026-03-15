'use strict';

const path = require('node:path');
const { loadMergedEnvFiles } = require('../src/utils/loadEnvFiles');
const {
  buildAdminSsoRoleMappingEnvLines,
  parseRoleNameRequests,
} = require('../src/utils/adminSsoRoleMapping');

loadMergedEnvFiles({
  basePath: path.resolve(process.cwd(), '.env'),
  overlayPath: path.resolve(process.cwd(), 'apps/web-portal-standalone/.env'),
  ignoreEmptyOverlay: true,
  overrideExisting: false,
});

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const [key, directValue] = token.split('=');
    const normalizedKey = key.slice(2);
    if (directValue != null) {
      out[normalizedKey] = directValue;
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[normalizedKey] = next;
      i += 1;
    } else {
      out[normalizedKey] = 'true';
    }
  }
  return out;
}

async function fetchDiscordGuildRoles({ guildId, token }) {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/roles`,
    {
      headers: {
        authorization: `Bot ${token}`,
        'user-agent': 'scum-admin-sso-role-export/1.0',
      },
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Discord API role fetch failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error('Discord API role fetch returned an unexpected payload');
  }
  return data
    .map((role) => ({
      id: String(role?.id || '').trim(),
      name: String(role?.name || '').trim(),
      position: Number(role?.position || 0),
      managed: role?.managed === true,
    }))
    .filter((role) => role.id && role.name)
    .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));
}

function buildRoleReport(roles = []) {
  return roles.map((role) => {
    const markers = [];
    if (role.managed) markers.push('managed');
    const suffix = markers.length > 0 ? ` [${markers.join(', ')}]` : '';
    return `- ${role.name} :: ${role.id} :: position=${role.position}${suffix}`;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    console.log(
      'Usage: node scripts/export-admin-discord-roles.js [--guild-id GUILD] [--token TOKEN] [--owner "Role A"] [--admin "Role B"] [--mod "Role C"]',
    );
    process.exit(0);
  }

  const guildId = String(
    args['guild-id'] || process.env.ADMIN_WEB_SSO_DISCORD_GUILD_ID || process.env.DISCORD_GUILD_ID || '',
  ).trim();
  const token = String(args.token || process.env.DISCORD_TOKEN || '').trim();
  if (!guildId) {
    throw new Error('guild id is required (--guild-id or ADMIN_WEB_SSO_DISCORD_GUILD_ID)');
  }
  if (!token) {
    throw new Error('Discord bot token is required (--token or DISCORD_TOKEN)');
  }

  const roles = await fetchDiscordGuildRoles({ guildId, token });
  console.log(`# Discord roles for guild ${guildId}`);
  for (const line of buildRoleReport(roles)) {
    console.log(line);
  }

  console.log('\n# Admin SSO role mapping env');
  const mapping = buildAdminSsoRoleMappingEnvLines(roles, {
    owner: parseRoleNameRequests(args.owner),
    admin: parseRoleNameRequests(args.admin),
    mod: parseRoleNameRequests(args.mod),
  });
  for (const line of mapping.envLines) {
    console.log(line);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[admin-sso-roles] ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  buildRoleReport,
  fetchDiscordGuildRoles,
  parseArgs,
};
