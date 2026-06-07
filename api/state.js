// GET /api/state - Returns current parking system state
const { getService } = require('./utils');

module.exports = (request, response) => {
  try {
    const service = getService();
    response.status(200).json(service.getState());
  } catch (error) {
    response.status(500).json({ error: error.message || 'Internal server error' });
  }
};
