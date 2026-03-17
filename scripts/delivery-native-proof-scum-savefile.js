'use strict';

const { runScumSavefileInventoryProof } = require('../src/services/deliveryNativeInventoryProof');

async function readStdin() {
  return new Promise((resolve, reject) => {
    let raw = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      raw += String(chunk || '');
    });
    process.stdin.on('end', () => resolve(raw));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const raw = await readStdin();
  if (!String(raw || '').trim()) {
    const result = {
      ok: false,
      code: 'DELIVERY_NATIVE_PROOF_EMPTY_INPUT',
      proofType: 'inventory-state',
      detail: 'No verification payload was provided.',
    };
    console.log(JSON.stringify(result));
    process.exit(1);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    const result = {
      ok: false,
      code: 'DELIVERY_NATIVE_PROOF_BAD_JSON',
      proofType: 'inventory-state',
      detail: 'Input payload is not valid JSON.',
    };
    console.log(JSON.stringify(result));
    process.exit(1);
  }

  const result = await runScumSavefileInventoryProof(payload, {
    env: process.env,
  });
  console.log(JSON.stringify(result));
  process.exit(result.ok ? 0 : 1);
}

main().catch((error) => {
  const result = {
    ok: false,
    code: 'DELIVERY_NATIVE_PROOF_RUNTIME_ERROR',
    proofType: 'inventory-state',
    detail: String(error?.message || error || 'Unknown native proof error'),
  };
  console.log(JSON.stringify(result));
  process.exit(1);
});
