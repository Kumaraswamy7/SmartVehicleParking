// POST /api/bookings/[id]/[action] - Handle booking actions (check-in, check-out, cancel)
const { getService } = require('../../utils');

module.exports = (request, response) => {
  try {
    if (request.method !== 'POST') {
      return response.status(405).json({ error: 'Method not allowed' });
    }

    const { id, action } = request.query;
    const service = getService();

    let result;
    if (action === 'check-in') {
      result = service.checkIn(id);
    } else if (action === 'check-out') {
      result = service.checkOut(id);
    } else if (action === 'cancel') {
      result = service.cancelBooking(id);
    } else {
      return response.status(400).json({ error: 'Invalid action' });
    }

    response.status(200).json(result);
  } catch (error) {
    response.status(500).json({ error: error.message || 'Internal server error' });
  }
};
