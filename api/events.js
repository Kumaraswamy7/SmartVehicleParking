// GET /api/events - Real-time events using SSE
// Note: Vercel has 15-minute timeout on free tier for streaming
// For production, consider using WebSocket (Socket.io) or polling

const { getService } = require('./utils');

module.exports = (request, response) => {
  try {
    if (request.method !== 'GET') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    const service = getService();

    // Set SSE headers
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial state
    response.write(`event: state\ndata: ${JSON.stringify(service.getState())}\n\n`);

    // Keep-alive ping every 30 seconds
    const keepAliveInterval = setInterval(() => {
      response.write(`: keep-alive\n\n`);
    }, 30000);

    // Close handler
    request.on('close', () => {
      clearInterval(keepAliveInterval);
      response.end();
    });

    // Timeout after 14 minutes (Vercel free tier limit is 15 min)
    setTimeout(() => {
      clearInterval(keepAliveInterval);
      response.end();
    }, 14 * 60 * 1000);
  } catch (error) {
    response.status(500).json({ error: error.message || 'Internal server error' });
  }
};
