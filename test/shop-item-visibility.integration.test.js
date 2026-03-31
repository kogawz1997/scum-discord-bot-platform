const test = require('node:test');
const assert = require('node:assert/strict');

require('dotenv').config({ override: true });

const {
  addShopItem,
  deleteShopItem,
  getShopItemById,
  listShopItems,
  setShopItemStatus,
  updateShopItem,
} = require('../src/store/memoryStore');

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

test('fixture shop items stay hidden from player-facing catalog queries by default', async () => {
  const itemId = uniqueId('fixture-test');
  try {
    const created = await addShopItem(
      itemId,
      'Fixture Delivery Item (Test)',
      99,
      'Fixture item for integration test cleanup',
      {
        gameItemId: 'Weapon_M1911',
        quantity: 1,
      },
    );
    assert.equal(created.id, itemId);

    const publicView = await getShopItemById(itemId);
    assert.equal(publicView, null);

    const publicList = await listShopItems();
    assert.equal(publicList.some((row) => row.id === itemId), false);

    const adminView = await getShopItemById(itemId, { includeTestItems: true });
    assert.equal(adminView?.id, itemId);

    const adminList = await listShopItems({ includeTestItems: true });
    assert.equal(adminList.some((row) => row.id === itemId), true);
  } finally {
    await deleteShopItem(itemId, {
      includeDisabled: true,
      includeTestItems: true,
    }).catch(() => null);
  }
});

test('shop item status changes persist to the database', async () => {
  const itemId = uniqueId('catalog-item');
  try {
    const created = await addShopItem(
      itemId,
      'Catalog Ready Item',
      125,
      'Visible catalog item',
      {
        gameItemId: 'Weapon_M9',
        quantity: 1,
      },
    );
    assert.equal(created.status, 'active');

    const disabled = await setShopItemStatus(itemId, 'disabled');
    assert.equal(disabled?.status, 'disabled');

    const hiddenPublicView = await getShopItemById(itemId);
    assert.equal(hiddenPublicView, null);

    const adminDisabledView = await getShopItemById(itemId, {
      includeDisabled: true,
      includeTestItems: true,
    });
    assert.equal(adminDisabledView?.status, 'disabled');

    const updated = await updateShopItem(itemId, {
      name: 'Catalog Ready Item v2',
      price: 150,
      description: 'Visible catalog item v2',
      status: 'active',
    });
    assert.equal(updated?.status, 'active');
    assert.equal(updated?.name, 'Catalog Ready Item v2');

    const publicView = await getShopItemById(itemId);
    assert.equal(publicView?.id, itemId);
    assert.equal(publicView?.status, 'active');
  } finally {
    await deleteShopItem(itemId, {
      includeDisabled: true,
      includeTestItems: true,
    }).catch(() => null);
  }
});
