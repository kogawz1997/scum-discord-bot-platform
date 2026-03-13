const http = require('node:http');

function asPort(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const port = Math.trunc(parsed);
  if (port < 0 || port > 65535) return fallback;
  return port;
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function startRuntimeHealthServer(options = {}) {
  const name = String(options.name || 'runtime').trim() || 'runtime';
  const host = String(options.host || '127.0.0.1').trim() || '127.0.0.1';
  const port = asPort(options.port, 0);
  const getPayload =
    typeof options.getPayload === 'function'
      ? options.getPayload
      : () => ({ ok: true });

  if (port <= 0) {
    return null;
  }

  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';
    if (req.method !== 'GET') {
      return sendJson(res, 405, { ok: false, error: 'method-not-allowed' });
    }

    if (url === '/' || url === '/healthz') {
      try {
        const resolvedPayload = await getPayload();
        const payload = {
          ok: true,
          service: name,
          ...(resolvedPayload && typeof resolvedPayload === 'object'
            ? resolvedPayload
            : { value: resolvedPayload }),
        };
        return sendJson(res, 200, payload);
      } catch (error) {
        return sendJson(res, 500, {
          ok: false,
          error: String(error?.message || 'health payload failed'),
        });
      }
    }

    return sendJson(res, 404, { ok: false, error: 'not-found' });
  });

  server.on('error', (error) => {
    if (error?.code === 'EADDRINUSE') {
      console.error(`[${name}] health port ${port} is already in use`);
      return;
    }
    console.error(`[${name}] health server error:`, error);
  });

  server.listen(port, host, () => {
    console.log(`[${name}] health endpoint: http://${host}:${port}/healthz`);
  });

  return server;
}

module.exports = {
  startRuntimeHealthServer,
};
