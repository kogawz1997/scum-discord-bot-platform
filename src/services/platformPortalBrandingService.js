'use strict';

function trimText(value, maxLen = 320) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function pickFirstText(values, maxLen = 320, fallback = '') {
  const list = Array.isArray(values) ? values : [values];
  for (const value of list) {
    const text = trimText(value, maxLen);
    if (text) return text;
  }
  return fallback;
}

function normalizePortalAssetUrl(value) {
  const text = trimText(value, 800);
  if (!text) return null;
  if (text.startsWith('/')) return text;
  try {
    const url = new URL(text);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeColorToken(value) {
  const text = trimText(value, 40);
  if (!text) return null;
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(text) ? text : null;
}

function normalizeMediaSlotKey(value) {
  const text = trimText(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return text || null;
}

function normalizeMediaSlotEntry(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const url = normalizePortalAssetUrl(value);
    return url ? { url, alt: null, title: null } : null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const url = normalizePortalAssetUrl(
    value.url || value.src || value.imageUrl || value.assetUrl,
  );
  if (!url) return null;
  return {
    url,
    alt: trimText(value.alt || value.label, 160) || null,
    title: trimText(value.title, 160) || null,
  };
}

function normalizeMediaSlotCollection(value) {
  const slots = value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
  if (!slots) return {};
  return Object.entries(slots).reduce((accumulator, [rawKey, rawValue]) => {
    const key = normalizeMediaSlotKey(rawKey);
    const entry = normalizeMediaSlotEntry(rawValue);
    if (!key || !entry) return accumulator;
    accumulator[key] = entry;
    return accumulator;
  }, {});
}

function normalizePublishedBranding(raw) {
  const published = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw
    : null;
  const settings = published?.settings && typeof published.settings === 'object' && !Array.isArray(published.settings)
    ? published.settings
    : null;
  if (!settings || Object.keys(settings).length === 0) return null;
  const version = Number.isFinite(Number(published?.version))
    ? Math.max(1, Math.trunc(Number(published.version)))
    : 1;
  return {
    version,
    publishedAt: trimText(published?.publishedAt, 80) || null,
    publishedBy: trimText(published?.publishedBy, 200) || null,
    settings,
  };
}

function resolvePortalBrandingSource(portalEnvPatch = {}) {
  const publishedBranding = normalizePublishedBranding(portalEnvPatch?.publishedBranding);
  return {
    patch: publishedBranding?.settings || portalEnvPatch,
    publishedBranding,
  };
}

function buildPortalThemeTokens(themeKey, brand = {}) {
  const presets = {
    'scum-dark': {
      primary: '#d3af6a',
      accent: '#b6ce84',
      surface: '#10180f',
      text: '#f3ede1',
    },
    'midnight-ops': {
      primary: '#67b7ff',
      accent: '#9be7c4',
      surface: '#0d1722',
      text: '#e7f2ff',
    },
    'field-station': {
      primary: '#d38c4a',
      accent: '#e3d66f',
      surface: '#1d1f16',
      text: '#f6f1e5',
    },
  };
  const preset = presets[themeKey] || presets['scum-dark'];
  return {
    primary: normalizeColorToken(brand.primaryColor) || preset.primary,
    accent: normalizeColorToken(brand.accentColor) || preset.accent,
    surface: preset.surface,
    text: preset.text,
  };
}

function buildBrandMark(siteName, fallback = 'SCUM') {
  const source = trimText(siteName, 120);
  if (!source) return fallback;
  const parts = source
    .split(/[\s_-]+/g)
    .map((entry) => trimText(entry, 32))
    .filter(Boolean);
  const mark = parts.slice(0, 2).map((entry) => entry.charAt(0).toUpperCase()).join('');
  return trimText(mark || source.slice(0, 4).toUpperCase(), 8) || fallback;
}

function buildTenantPortalBranding(options = {}) {
  const tenant = options.tenant && typeof options.tenant === 'object' ? options.tenant : {};
  const tenantConfig = options.tenantConfig && typeof options.tenantConfig === 'object' ? options.tenantConfig : {};
  const draftPortalEnvPatch = tenantConfig.portalEnvPatch && typeof tenantConfig.portalEnvPatch === 'object'
    ? tenantConfig.portalEnvPatch
    : {};
  const {
    patch: portalEnvPatch,
    publishedBranding,
  } = resolvePortalBrandingSource(draftPortalEnvPatch);
  const surface = trimText(options.surface, 40).toLowerCase() || 'public';
  const fallbackSiteName = pickFirstText([
    options.fallbackSiteName,
    tenant.name,
    tenant.slug,
    'SCUM Community',
  ], 160, 'SCUM Community');
  const fallbackSiteDetail = pickFirstText([
    options.fallbackSiteDetail,
    `Managed ${surface} workspace for ${fallbackSiteName}.`,
  ], 280, `Managed ${surface} workspace`);
  const theme = pickFirstText([
    surface === 'player' ? portalEnvPatch.playerTheme : portalEnvPatch.publicTheme,
    portalEnvPatch.theme,
    surface === 'player' ? portalEnvPatch.publicTheme : portalEnvPatch.playerTheme,
    'scum-dark',
  ], 80, 'scum-dark');
  const oppositeSurface = surface === 'player' ? 'public' : 'player';
  const mediaSlots = {
    ...normalizeMediaSlotCollection(portalEnvPatch[`${oppositeSurface}MediaSlots`]),
    ...normalizeMediaSlotCollection(portalEnvPatch.mediaSlots),
    ...normalizeMediaSlotCollection(portalEnvPatch[`${surface}MediaSlots`]),
  };
  const logoSlotUrl = pickFirstText([
    mediaSlots.logo?.url,
    mediaSlots.mark?.url,
  ], 800, '');
  const bannerSlotUrl = pickFirstText([
    mediaSlots.banner?.url,
    mediaSlots.hero?.url,
    mediaSlots.header?.url,
  ], 800, '');
  const faviconUrl = normalizePortalAssetUrl(
    portalEnvPatch.faviconUrl
    || mediaSlots.favicon?.url
    || '',
  );
  const siteName = pickFirstText([
    surface === 'player' ? portalEnvPatch.playerSiteName : '',
    surface === 'public' ? portalEnvPatch.publicSiteName : '',
    portalEnvPatch.siteName,
    fallbackSiteName,
  ], 160, fallbackSiteName);
  const siteDetail = pickFirstText([
    surface === 'player' ? portalEnvPatch.playerSiteDetail : '',
    surface === 'public' ? portalEnvPatch.publicSiteDetail : '',
    portalEnvPatch.siteDescription,
    fallbackSiteDetail,
  ], 280, fallbackSiteDetail);
  const logoUrl = normalizePortalAssetUrl(
    surface === 'player'
      ? portalEnvPatch.playerLogoUrl || portalEnvPatch.logoUrl || portalEnvPatch.publicLogoUrl || logoSlotUrl
      : portalEnvPatch.publicLogoUrl || portalEnvPatch.logoUrl || portalEnvPatch.playerLogoUrl || logoSlotUrl,
  );
  const bannerUrl = normalizePortalAssetUrl(
    surface === 'player'
      ? portalEnvPatch.playerBannerUrl || portalEnvPatch.bannerUrl || portalEnvPatch.publicBannerUrl || bannerSlotUrl
      : portalEnvPatch.publicBannerUrl || portalEnvPatch.bannerUrl || portalEnvPatch.playerBannerUrl || bannerSlotUrl,
  );
  const primaryColor = normalizeColorToken(
    surface === 'player'
      ? portalEnvPatch.playerPrimaryColor || portalEnvPatch.primaryColor || portalEnvPatch.publicPrimaryColor
      : portalEnvPatch.publicPrimaryColor || portalEnvPatch.primaryColor || portalEnvPatch.playerPrimaryColor,
  );
  const accentColor = normalizeColorToken(
    surface === 'player'
      ? portalEnvPatch.playerAccentColor || portalEnvPatch.accentColor || portalEnvPatch.publicAccentColor
      : portalEnvPatch.publicAccentColor || portalEnvPatch.accentColor || portalEnvPatch.playerAccentColor,
  );
  const brand = {
    surface,
    slug: trimText(tenant.slug, 160) || normalizeSlug(siteName) || null,
    siteName,
    siteDetail,
    theme,
    logoUrl,
    bannerUrl,
    faviconUrl,
    primaryColor,
    accentColor,
    mediaSlots,
  };
  return {
    ...brand,
    brandMark: buildBrandMark(siteName, 'SCUM'),
    publishedAt: publishedBranding?.publishedAt || null,
    publishedBy: publishedBranding?.publishedBy || null,
    publishedVersion: publishedBranding?.version || null,
    themeTokens: buildPortalThemeTokens(theme, brand),
    usesPublishedBranding: Boolean(publishedBranding),
  };
}

module.exports = {
  buildPortalThemeTokens,
  buildTenantPortalBranding,
  normalizeColorToken,
  normalizePortalAssetUrl,
};
