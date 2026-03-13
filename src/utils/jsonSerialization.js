function normalizeBigIntForJson(value) {
  if (typeof value !== 'bigint') return value;
  if (
    value <= BigInt(Number.MAX_SAFE_INTEGER)
    && value >= BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return Number(value);
  }
  return String(value);
}

function jsonBigIntReplacer(_key, value) {
  if (typeof value === 'bigint') {
    return normalizeBigIntForJson(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function safeJsonStringify(value, space) {
  return JSON.stringify(value, jsonBigIntReplacer, space);
}

function installBigIntJsonSerialization() {
  if (
    typeof BigInt !== 'function'
    || typeof BigInt.prototype !== 'object'
    || typeof BigInt.prototype.toJSON === 'function'
  ) {
    return;
  }
  Object.defineProperty(BigInt.prototype, 'toJSON', {
    configurable: true,
    writable: true,
    enumerable: false,
    value() {
      return normalizeBigIntForJson(this.valueOf());
    },
  });
}

module.exports = {
  jsonBigIntReplacer,
  normalizeBigIntForJson,
  safeJsonStringify,
  installBigIntJsonSerialization,
};
