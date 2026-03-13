const test = require('node:test');
const assert = require('node:assert/strict');

const {
  repairMojibakeText,
  repairJsonText,
} = require('../src/utils/textRepair');

test('repairMojibakeText repairs common Thai mojibake', () => {
  const mojibake = Buffer.from('สวัสดี', 'utf8').toString('latin1');
  const repaired = repairMojibakeText(mojibake);
  assert.equal(repaired.changed, true);
  assert.equal(repaired.value, 'สวัสดี');
});

test('repairJsonText repairs nested mojibake in JSON payload', () => {
  const raw = JSON.stringify({
    title: Buffer.from('สวัสดี', 'utf8').toString('latin1'),
    nested: {
      label: Buffer.from('เซิร์ฟ', 'utf8').toString('latin1'),
    },
  });

  const repaired = repairJsonText(raw);
  assert.equal(repaired.changed, true);
  const parsed = JSON.parse(repaired.value);
  assert.equal(parsed.title, 'สวัสดี');
  assert.equal(parsed.nested.label, 'เซิร์ฟ');
});
