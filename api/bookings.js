// POST /api/bookings - Create new parking booking
const { getService, readBody } = require('./utils');

module.exports = async (request, response) => {
  try {
    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    const service = getService();
    const body = await readBody(request);
    const result = service.allocateSlot(body);

    response.status(201).json(result);
  } catch (error) {
    response.status(500).json({ error: error.message || 'Internal server error' });
  }
};
