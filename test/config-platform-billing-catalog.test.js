const test = require('node:test');
const assert = require('node:assert/strict');

const config = require('../src/config');

test('config preserves default platform billing quotas when stored plan snapshots are partial', async () => {
  const originalConfig = config.getConfigSnapshot();
  await config.initConfigStore?.();

  try {
    config.setFullConfig({
      platform: {
        billing: {
          plans: [
            {
              id: 'trial-14d',
              name: 'Trial 14 วัน',
              billingCycle: 'trial',
            },
          ],
        },
      },
    });
    await config.flushConfigWrites?.();

    const snapshot = config.getConfigSnapshot();
    const plans = Array.isArray(snapshot?.platform?.billing?.plans)
      ? snapshot.platform.billing.plans
      : [];
    const trialPlan = plans.find((entry) => String(entry?.id || '').trim() === 'trial-14d');
    const starterPlan = plans.find((entry) => String(entry?.id || '').trim() === 'platform-starter');

    assert.ok(trialPlan, 'expected trial plan to remain available');
    assert.equal(Number(trialPlan?.quotas?.apiKeys || 0), 1);
    assert.equal(Number(trialPlan?.quotas?.webhooks || 0), 2);
    assert.ok(Array.isArray(trialPlan?.features) && trialPlan.features.length >= 1);
    assert.ok(starterPlan, 'expected missing default plans to be restored');
    assert.equal(Number(starterPlan?.quotas?.apiKeys || 0), 3);
  } finally {
    config.setFullConfig(originalConfig);
    await config.flushConfigWrites?.();
  }
});
