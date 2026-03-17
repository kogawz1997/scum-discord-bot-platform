'use strict';

let input = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += String(chunk || '');
});

process.stdin.on('end', () => {
  let payload = {};
  try {
    payload = JSON.parse(String(input || '{}'));
  } catch {
    payload = {};
  }

  const purchaseCode = String(payload.purchaseCode || '').trim();
  if (purchaseCode === 'P-BAD-JSON') {
    process.stdout.write('not-json');
    return;
  }

  const ok = purchaseCode !== 'P-FAIL-NATIVE';
  process.stdout.write(JSON.stringify({
    ok,
    proofType: 'inventory-state',
    detail: ok ? 'Inventory state confirmed' : 'Inventory state mismatch',
    warnings: ok ? [] : ['inventory snapshot did not match expected items'],
    evidence: {
      purchaseCode: purchaseCode || null,
      expectedItems: Array.isArray(payload.expectedItems) ? payload.expectedItems : [],
    },
  }));
});

process.stdin.resume();
