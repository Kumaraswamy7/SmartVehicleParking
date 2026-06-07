// POST /api/demo/reset - Reset demo data
const { getService } = require('../utils');

module.exports = (request, response) => {
  try {
    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    const service = getService();
    const state = service.resetDemo();

    response.status(200).json(state);
  } catch (error) {
    response.status(500).json({ error: error.message || 'Internal server error' });
  }
};
