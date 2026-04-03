const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildTenantPortalBranding,
} = require('../src/services/platformPortalBrandingService');

test('platform portal branding service resolves shared player/public branding safely', () => {
  const branding = buildTenantPortalBranding({
    surface: 'player',
    tenant: {
      id: 'tenant-1',
      slug: 'prime-scum',
      name: 'Prime SCUM',
    },
    tenantConfig: {
      portalEnvPatch: {
        siteName: 'Prime SCUM Network',
        siteDescription: 'The official player hub',
        logoUrl: 'https://cdn.example.com/logo.png',
        bannerUrl: '/branding/banner.jpg',
        primaryColor: '#3366ff',
        accentColor: '#99ddaa',
        publicTheme: 'midnight-ops',
      },
    },
  });

  assert.equal(branding.surface, 'player');
  assert.equal(branding.siteName, 'Prime SCUM Network');
  assert.equal(branding.siteDetail, 'The official player hub');
  assert.equal(branding.logoUrl, 'https://cdn.example.com/logo.png');
  assert.equal(branding.bannerUrl, '/branding/banner.jpg');
  assert.equal(branding.primaryColor, '#3366ff');
  assert.equal(branding.accentColor, '#99ddaa');
  assert.equal(branding.theme, 'midnight-ops');
  assert.equal(branding.themeTokens.primary, '#3366ff');
  assert.equal(branding.themeTokens.accent, '#99ddaa');
  assert.equal(branding.brandMark, 'PS');
});

test('platform portal branding service rejects unsafe asset URLs and invalid colors', () => {
  const branding = buildTenantPortalBranding({
    surface: 'public',
    tenant: {
      slug: 'unsafe-community',
      name: 'Unsafe Community',
    },
    tenantConfig: {
      portalEnvPatch: {
        publicLogoUrl: 'javascript:alert(1)',
        publicBannerUrl: 'ftp://example.com/banner.png',
        publicPrimaryColor: 'red',
        publicAccentColor: '#445566',
      },
    },
  });

  assert.equal(branding.logoUrl, null);
  assert.equal(branding.bannerUrl, null);
  assert.equal(branding.primaryColor, null);
  assert.equal(branding.accentColor, '#445566');
  assert.equal(branding.siteName, 'Unsafe Community');
});

test('platform portal branding service prefers published branding over the draft patch', () => {
  const branding = buildTenantPortalBranding({
    surface: 'player',
    tenant: {
      id: 'tenant-1',
      slug: 'prime-scum',
      name: 'Prime SCUM',
    },
    tenantConfig: {
      portalEnvPatch: {
        siteName: 'Draft site',
        primaryColor: '#ff5500',
        publishedBranding: {
          version: 4,
          publishedAt: '2026-04-03T12:00:00.000Z',
          publishedBy: 'tenant-web:owner-1',
          settings: {
            siteName: 'Published site',
            siteDescription: 'Published player hub',
            primaryColor: '#112233',
            accentColor: '#99ddaa',
          },
        },
      },
    },
  });

  assert.equal(branding.siteName, 'Published site');
  assert.equal(branding.siteDetail, 'Published player hub');
  assert.equal(branding.primaryColor, '#112233');
  assert.equal(branding.accentColor, '#99ddaa');
  assert.equal(branding.usesPublishedBranding, true);
  assert.equal(branding.publishedVersion, 4);
  assert.equal(branding.publishedBy, 'tenant-web:owner-1');
});

test('platform portal branding service resolves slot-based media safely for each surface', () => {
  const branding = buildTenantPortalBranding({
    surface: 'public',
    tenant: {
      id: 'tenant-2',
      slug: 'slot-hub',
      name: 'Slot Hub',
    },
    tenantConfig: {
      portalEnvPatch: {
        mediaSlots: {
          logo: { url: 'https://cdn.example.com/shared-logo.png', alt: 'Shared logo' },
          hero: { url: 'https://cdn.example.com/shared-hero.png', alt: 'Shared hero' },
        },
        publicMediaSlots: {
          hero: { url: 'https://cdn.example.com/public-hero.png', alt: 'Public hero' },
          favicon: { url: '/branding/favicon.png' },
        },
        playerMediaSlots: {
          hero: { url: 'https://cdn.example.com/player-hero.png', alt: 'Player hero' },
        },
      },
    },
  });

  assert.equal(branding.logoUrl, 'https://cdn.example.com/shared-logo.png');
  assert.equal(branding.bannerUrl, 'https://cdn.example.com/public-hero.png');
  assert.equal(branding.faviconUrl, '/branding/favicon.png');
  assert.equal(branding.mediaSlots.logo.url, 'https://cdn.example.com/shared-logo.png');
  assert.equal(branding.mediaSlots.hero.url, 'https://cdn.example.com/public-hero.png');
  assert.equal(branding.mediaSlots.hero.alt, 'Public hero');
});

test('platform portal branding service drops unsafe slot media values', () => {
  const branding = buildTenantPortalBranding({
    surface: 'player',
    tenant: {
      slug: 'unsafe-slot-community',
      name: 'Unsafe Slot Community',
    },
    tenantConfig: {
      portalEnvPatch: {
        mediaSlots: {
          hero: { url: 'javascript:alert(1)' },
          logo: { url: 'ftp://example.com/logo.png' },
          safe: { url: 'https://cdn.example.com/safe.png', alt: 'Safe media' },
        },
      },
    },
  });

  assert.equal(branding.bannerUrl, null);
  assert.equal(branding.logoUrl, null);
  assert.equal(branding.mediaSlots.hero, undefined);
  assert.equal(branding.mediaSlots.logo, undefined);
  assert.equal(branding.mediaSlots.safe.url, 'https://cdn.example.com/safe.png');
});
