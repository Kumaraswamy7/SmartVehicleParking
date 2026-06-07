// POST /api/slots/[id]/status - Update slot status
const { getService, readBody } = require('../utils');

module.exports = async (request, response) => {
  try {
    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    const { id } = request.query;
    const body = await readBody(request);
    const service = getService();
    const result = service.updateSlotStatus(id, body.status);

    response.status(200).json(result);
  } catch (error) {
    response.status(500).json({ error: error.message || 'Internal server error' });
  }
};
