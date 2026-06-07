const http = require('http');
const fs = require('fs');
const path = require('path');
const { createParkingService } = require('./parkingService');
const { createJsonStore } = require('./store');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const service = createParkingService(createJsonStore());
const eventClients = new Set();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8'
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.url === '/events') {
      return handleEvents(request, response);
    }

    if (request.url.startsWith('/api/')) {
      return await handleApi(request, response);
    }

    return serveStatic(request, response);
  } catch (error) {
    return sendJson(response, 500, { error: error.message || 'Internal server error' });
  }
});

setInterval(() => {
  const state = service.releaseExpiredReservations();
  if (state) {
    broadcast('state', state);
  }
}, 30 * 1000).unref();

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    console.error(`The app may already be running at http://localhost:${PORT}`);
    console.error(`To use another port: $env:PORT=3001; npm start`);
    process.exit(1);
  }

  throw error;
});

server.listen(PORT, () => {
  console.log(`Smart Vehicle Parking System running at http://localhost:${PORT}`);
});

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === 'GET' && url.pathname === '/api/state') {
    return sendJson(response, 200, service.getState());
  }

  if (request.method === 'POST' && url.pathname === '/api/bookings') {
    const result = service.allocateSlot(await readBody(request));
    broadcast('state', service.getState());
    return sendJson(response, 201, result);
  }

  const bookingAction = url.pathname.match(/^\/api\/bookings\/([^/]+)\/(check-in|check-out|cancel)$/);
  if (request.method === 'POST' && bookingAction) {
    const [, bookingId, action] = bookingAction;
    const result = action === 'check-in'
      ? service.checkIn(bookingId)
      : action === 'check-out'
        ? service.checkOut(bookingId)
        : service.cancelBooking(bookingId);
    broadcast('state', service.getState());
    return sendJson(response, 200, result);
  }

  const slotAction = url.pathname.match(/^\/api\/slots\/([^/]+)\/status$/);
  if (request.method === 'POST' && slotAction) {
    const body = await readBody(request);
    const result = service.updateSlotStatus(slotAction[1], body.status);
    broadcast('state', service.getState());
    return sendJson(response, 200, result);
  }

  if (request.method === 'POST' && url.pathname === '/api/demo/reset') {
    const state = service.resetDemo();
    broadcast('state', state);
    return sendJson(response, 200, state);
  }

  return sendJson(response, 404, { error: 'Endpoint not found' });
}

function handleEvents(request, response) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  response.write(`event: state\ndata: ${JSON.stringify(service.getState())}\n\n`);
  eventClients.add(response);
  request.on('close', () => eventClients.delete(response));
}

function broadcast(event, payload) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of eventClients) {
    client.write(message);
  }
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const safePath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': mimeTypes[path.extname(filePath)] || 'application/octet-stream'
    });
    response.end(content);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        request.destroy();
        reject(new Error('Request body is too large'));
      }
    });
    request.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error('Invalid JSON payload'));
      }
    });
  });
}
