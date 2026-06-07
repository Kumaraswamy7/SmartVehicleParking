// Shared utilities for Vercel serverless functions
const { createParkingService } = require('../src/parkingService');
const { createJsonStore } = require('../src/store');

let service = null;

function getService() {
  if (!service) {
    service = createParkingService(createJsonStore());
    // Clean up expired reservations periodically
    setInterval(() => {
      service.releaseExpiredReservations();
    }, 30 * 1000);
  }
  return service;
}

async function readBody(request) {
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

function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

module.exports = {
  getService,
  readBody,
  sendJson
};
