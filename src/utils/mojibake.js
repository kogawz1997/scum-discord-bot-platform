const MOJIBAKE_MARKERS = [
  '\u00C3',
  '\u00C2',
  '\u00E0\u00B8',
  '\u00E0\u00B9',
  '\u00E2\u0153',
  '\u00F0\u0178',
  '\uFFFD',
];

function looksLikeMojibake(value) {
  const text = String(value || '');
  return MOJIBAKE_MARKERS.some((marker) => text.includes(marker));
}

module.exports = {
  MOJIBAKE_MARKERS,
  looksLikeMojibake,
};
