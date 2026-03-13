const { looksLikeMojibake } = require('./mojibake');

const CP1252_REVERSE_MAP = new Map([
  ['\u20AC', 0x80],
  ['\u201A', 0x82],
  ['\u0192', 0x83],
  ['\u201E', 0x84],
  ['\u2026', 0x85],
  ['\u2020', 0x86],
  ['\u2021', 0x87],
  ['\u02C6', 0x88],
  ['\u2030', 0x89],
  ['\u0160', 0x8A],
  ['\u2039', 0x8B],
  ['\u0152', 0x8C],
  ['\u017D', 0x8E],
  ['\u2018', 0x91],
  ['\u2019', 0x92],
  ['\u201C', 0x93],
  ['\u201D', 0x94],
  ['\u2022', 0x95],
  ['\u2013', 0x96],
  ['\u2014', 0x97],
  ['\u02DC', 0x98],
  ['\u2122', 0x99],
  ['\u0161', 0x9A],
  ['\u203A', 0x9B],
  ['\u0153', 0x9C],
  ['\u017E', 0x9E],
  ['\u0178', 0x9F],
]);

function mojibakeScore(value) {
  const text = String(value || '');
  let score = 0;
  const markers = ['\u00C3', '\u00C2', '\u00E0\u00B8', '\u00E0\u00B9', '\uFFFD'];
  for (const marker of markers) {
    let index = text.indexOf(marker);
    while (index >= 0) {
      score += 1;
      index = text.indexOf(marker, index + marker.length);
    }
  }
  return score;
}

function tryLatin1ToUtf8(value) {
  try {
    return Buffer.from(String(value || ''), 'latin1').toString('utf8');
  } catch {
    return String(value || '');
  }
}

function tryWindows1252ToUtf8(value) {
  try {
    const bytes = [];
    for (const char of String(value || '')) {
      const codePoint = char.codePointAt(0);
      if (codePoint <= 0xFF) {
        bytes.push(codePoint);
        continue;
      }
      if (!CP1252_REVERSE_MAP.has(char)) {
        return String(value || '');
      }
      bytes.push(CP1252_REVERSE_MAP.get(char));
    }
    return Buffer.from(bytes).toString('utf8');
  } catch {
    return String(value || '');
  }
}

function isReadableRepair(candidate, original) {
  if (!candidate || candidate === original) return false;

  const originalScore = mojibakeScore(original);
  const candidateScore = mojibakeScore(candidate);
  const candidateHasThai = /[\u0E00-\u0E7F]/.test(candidate);
  const originalHasThai = /[\u0E00-\u0E7F]/.test(original);

  if (candidateScore === 0 && originalScore > 0) return true;
  if (candidateScore < originalScore && candidateHasThai) return true;
  if (candidateScore < originalScore && !originalHasThai) return true;
  return false;
}

function repairMojibakeText(value) {
  const original = String(value || '');
  if (!original || !looksLikeMojibake(original)) {
    return { changed: false, value: original, strategy: null };
  }

  const candidate = tryLatin1ToUtf8(original);
  const candidates = [
    {
      strategy: 'windows1252->utf8',
      value: tryWindows1252ToUtf8(original),
    },
    {
      strategy: 'latin1->utf8',
      value: candidate,
    },
  ];

  for (const next of candidates) {
    if (!isReadableRepair(next.value, original)) continue;
    return {
      changed: true,
      value: next.value,
      strategy: next.strategy,
    };
  }

  return { changed: false, value: original, strategy: null };
}

function repairValueDeep(value) {
  if (typeof value === 'string') {
    return repairMojibakeText(value);
  }

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const result = repairValueDeep(item);
      if (result.changed) changed = true;
      return result.value;
    });
    return { changed, value: next, strategy: changed ? 'deep-array' : null };
  }

  if (value && typeof value === 'object') {
    let changed = false;
    const next = {};
    for (const [key, nested] of Object.entries(value)) {
      const result = repairValueDeep(nested);
      if (result.changed) changed = true;
      next[key] = result.value;
    }
    return { changed, value: next, strategy: changed ? 'deep-object' : null };
  }

  return { changed: false, value, strategy: null };
}

function repairJsonText(value) {
  const original = String(value || '');
  if (!original) {
    return { changed: false, value: original, strategy: null };
  }

  try {
    const parsed = JSON.parse(original);
    const repaired = repairValueDeep(parsed);
    if (!repaired.changed) {
      return { changed: false, value: original, strategy: null };
    }
    return {
      changed: true,
      value: JSON.stringify(repaired.value),
      strategy: 'json-deep-repair',
    };
  } catch {
    return repairMojibakeText(original);
  }
}

module.exports = {
  repairMojibakeText,
  repairValueDeep,
  repairJsonText,
};
