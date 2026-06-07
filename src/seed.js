function createSeedData() {
  return {
    facility: {
      name: 'Pallavi Smart Parking Hub',
      location: 'Main Academic Block',
      currency: 'INR',
      reservationTimeoutMinutes: 15
    },
    slots: createSlots(),
    bookings: [],
    auditLogs: []
  };
}

function createSlots() {
  const slots = [];
  const zones = [
    { prefix: 'A', zone: 'General', floor: 1, vehicleType: 'sedan', count: 8, startDistance: 2 },
    { prefix: 'B', zone: 'General', floor: 1, vehicleType: 'suv', count: 6, startDistance: 6 },
    { prefix: 'C', zone: 'VIP', floor: 1, vehicleType: 'sedan', count: 4, startDistance: 1 },
    { prefix: 'D', zone: 'General', floor: 2, vehicleType: 'motorcycle', count: 6, startDistance: 3 },
    { prefix: 'E', zone: 'General', floor: 2, vehicleType: 'truck', count: 4, startDistance: 12 }
  ];

  for (const zone of zones) {
    for (let index = 1; index <= zone.count; index += 1) {
      slots.push({
        id: `${zone.prefix}${String(index).padStart(2, '0')}`,
        zone: zone.zone,
        floor: zone.floor,
        vehicleType: zone.vehicleType,
        distanceIndex: zone.startDistance + index,
        status: 'available',
        currentVehicle: null,
        reservedAt: null
      });
    }
  }

  return slots;
}

module.exports = {
  createSeedData
};
