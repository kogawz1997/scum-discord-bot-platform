const { EventEmitter } = require('node:events');
const { persistAdminLiveEvent } = require('../store/adminNotificationStore');

const adminLiveBus = new EventEmitter();
adminLiveBus.setMaxListeners(100);

function publishAdminLiveUpdate(type, payload = {}) {
  try {
    persistAdminLiveEvent(type, payload);
  } catch (error) {
    console.error('[adminLiveBus] failed to persist live event:', error.message);
  }
  adminLiveBus.emit('update', {
    type: String(type || 'update'),
    payload: payload && typeof payload === 'object' ? payload : {},
    at: new Date().toISOString(),
  });
}

module.exports = {
  adminLiveBus,
  publishAdminLiveUpdate,
};
