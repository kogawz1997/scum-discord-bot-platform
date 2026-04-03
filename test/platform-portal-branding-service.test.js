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
