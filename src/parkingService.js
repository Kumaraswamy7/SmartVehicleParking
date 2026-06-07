const RESERVATION_TIMEOUT_MS = 15 * 60 * 1000;
const BASE_FEE = 20;
const HOURLY_RATE = 35;

const vehicleRank = {
  motorcycle: 1,
  sedan: 2,
  suv: 3,
  truck: 4
};

function normalizeVehicleType(type) {
  const value = String(type || '').toLowerCase().trim();
  if (!vehicleRank[value]) {
    throw new Error('Unsupported vehicle type');
  }
  return value;
}

function canFit(slotType, vehicleType) {
  return vehicleRank[slotType] >= vehicleRank[vehicleType];
}

function publicBooking(booking) {
  return {
    ...booking,
    fee: Number(booking.fee || 0)
  };
}

function createParkingService(store, options = {}) {
  const now = options.now || (() => new Date());
  const reservationTimeoutMs = options.reservationTimeoutMs || RESERVATION_TIMEOUT_MS;

  function getState() {
    const data = store.read();
    return {
      facility: data.facility,
      slots: data.slots,
      bookings: data.bookings.map(publicBooking),
      stats: buildStats(data)
    };
  }

  function buildStats(data) {
    const total = data.slots.length;
    const available = data.slots.filter((slot) => slot.status === 'available').length;
    const reserved = data.slots.filter((slot) => slot.status === 'reserved').length;
    const occupied = data.slots.filter((slot) => slot.status === 'occupied').length;
    const maintenance = data.slots.filter((slot) => slot.status === 'maintenance').length;
    const revenue = data.bookings.reduce((sum, booking) => sum + Number(booking.fee || 0), 0);
    const activeSessions = data.bookings.filter((booking) => ['reserved', 'active'].includes(booking.status)).length;

    return {
      total,
      available,
      reserved,
      occupied,
      maintenance,
      activeSessions,
      occupancyRate: total ? Math.round(((reserved + occupied) / total) * 100) : 0,
      revenue
    };
  }

  function allocateSlot(payload) {
    const vehicleType = normalizeVehicleType(payload.vehicleType);
    const driverName = String(payload.driverName || '').trim();
    const vehicleNumber = String(payload.vehicleNumber || '').trim().toUpperCase();
    const priority = String(payload.priority || 'standard').toLowerCase() === 'vip' ? 'vip' : 'standard';

    if (driverName.length < 2) {
      throw new Error('Driver name is required');
    }

    if (vehicleNumber.length < 4) {
      throw new Error('Vehicle number is required');
    }

    const data = store.read();
    const activeForVehicle = data.bookings.find((booking) => (
      booking.vehicleNumber === vehicleNumber && ['reserved', 'active'].includes(booking.status)
    ));

    if (activeForVehicle) {
      throw new Error('This vehicle already has an active booking');
    }

    let candidates = data.slots.filter((slot) => (
      slot.status === 'available' && canFit(slot.vehicleType, vehicleType)
    ));

    const vipCandidates = candidates.filter((slot) => slot.zone === 'VIP');
    if (priority === 'vip' && vipCandidates.length > 0) {
      candidates = vipCandidates;
    } else if (priority !== 'vip') {
      candidates = candidates.filter((slot) => slot.zone !== 'VIP');
    }

    if (candidates.length === 0) {
      throw new Error('No suitable slots available');
    }

    candidates.sort((a, b) => (
      a.distanceIndex - b.distanceIndex ||
      a.floor - b.floor ||
      a.id.localeCompare(b.id)
    ));

    const selected = candidates[0];
    if (selected.status !== 'available') {
      throw new Error('Concurrent booking conflict. Please retry.');
    }

    const timestamp = now().toISOString();
    selected.status = 'reserved';
    selected.currentVehicle = vehicleNumber;
    selected.reservedAt = timestamp;

    const booking = {
      id: `BKG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      driverName,
      vehicleNumber,
      vehicleType,
      priority,
      slotId: selected.id,
      zone: selected.zone,
      floor: selected.floor,
      status: 'reserved',
      reservedAt: timestamp,
      checkedInAt: null,
      checkedOutAt: null,
      fee: 0
    };

    data.bookings.unshift(booking);
    data.auditLogs.unshift({
      id: `LOG-${Date.now()}`,
      type: 'reserve',
      message: `${vehicleNumber} reserved ${selected.id}`,
      at: timestamp
    });
    store.write(data);

    return { booking: publicBooking(booking), slot: selected, stats: buildStats(data) };
  }

  function checkIn(bookingId) {
    const data = store.read();
    const booking = findBooking(data, bookingId);
    assertStatus(booking, 'reserved');
    const slot = findSlot(data, booking.slotId);
    const timestamp = now().toISOString();

    booking.status = 'active';
    booking.checkedInAt = timestamp;
    slot.status = 'occupied';
    slot.reservedAt = null;
    pushLog(data, 'check-in', `${booking.vehicleNumber} checked in at ${slot.id}`);
    store.write(data);

    return { booking: publicBooking(booking), slot, stats: buildStats(data) };
  }

  function checkOut(bookingId) {
    const data = store.read();
    const booking = findBooking(data, bookingId);
    assertStatus(booking, 'active');
    const slot = findSlot(data, booking.slotId);
    const timestamp = now().toISOString();

    booking.status = 'completed';
    booking.checkedOutAt = timestamp;
    booking.fee = calculateFee(booking.checkedInAt, booking.checkedOutAt);
    slot.status = 'available';
    slot.currentVehicle = null;
    slot.reservedAt = null;
    pushLog(data, 'check-out', `${booking.vehicleNumber} checked out from ${slot.id}`);
    store.write(data);

    return { booking: publicBooking(booking), slot, stats: buildStats(data) };
  }

  function cancelBooking(bookingId) {
    const data = store.read();
    const booking = findBooking(data, bookingId);
    if (!['reserved', 'active'].includes(booking.status)) {
      throw new Error('Only active or reserved bookings can be cancelled');
    }

    const slot = findSlot(data, booking.slotId);
    booking.status = 'cancelled';
    booking.checkedOutAt = now().toISOString();
    slot.status = 'available';
    slot.currentVehicle = null;
    slot.reservedAt = null;
    pushLog(data, 'cancel', `${booking.vehicleNumber} booking cancelled for ${slot.id}`);
    store.write(data);

    return { booking: publicBooking(booking), slot, stats: buildStats(data) };
  }

  function updateSlotStatus(slotId, status) {
    const allowed = new Set(['available', 'maintenance']);
    if (!allowed.has(status)) {
      throw new Error('Admin can only mark slots available or maintenance');
    }

    const data = store.read();
    const slot = findSlot(data, slotId);
    const activeBooking = data.bookings.find((booking) => (
      booking.slotId === slot.id && ['reserved', 'active'].includes(booking.status)
    ));

    if (activeBooking && status === 'maintenance') {
      throw new Error('Cannot mark an active booking slot as maintenance');
    }

    slot.status = status;
    slot.currentVehicle = null;
    slot.reservedAt = null;
    pushLog(data, 'admin', `${slot.id} marked ${status}`);
    store.write(data);

    return { slot, stats: buildStats(data) };
  }

  function releaseExpiredReservations() {
    const data = store.read();
    const cutoff = now().getTime() - reservationTimeoutMs;
    let changed = false;

    for (const booking of data.bookings) {
      if (booking.status !== 'reserved') continue;
      if (new Date(booking.reservedAt).getTime() > cutoff) continue;

      const slot = data.slots.find((item) => item.id === booking.slotId);
      booking.status = 'expired';
      booking.checkedOutAt = now().toISOString();
      if (slot) {
        slot.status = 'available';
        slot.currentVehicle = null;
        slot.reservedAt = null;
      }
      changed = true;
      pushLog(data, 'timeout', `${booking.vehicleNumber} reservation expired for ${booking.slotId}`);
    }

    if (changed) {
      store.write(data);
    }

    return changed ? getState() : null;
  }

  function resetDemo() {
    store.reset();
    return getState();
  }

  return {
    getState,
    allocateSlot,
    checkIn,
    checkOut,
    cancelBooking,
    updateSlotStatus,
    releaseExpiredReservations,
    resetDemo
  };
}

function calculateFee(checkedInAt, checkedOutAt) {
  const minutes = Math.max(1, Math.ceil((new Date(checkedOutAt) - new Date(checkedInAt)) / 60000));
  const hours = Math.max(1, Math.ceil(minutes / 60));
  return BASE_FEE + (hours * HOURLY_RATE);
}

function findBooking(data, bookingId) {
  const booking = data.bookings.find((item) => item.id === bookingId);
  if (!booking) {
    throw new Error('Booking not found');
  }
  return booking;
}

function findSlot(data, slotId) {
  const slot = data.slots.find((item) => item.id === slotId);
  if (!slot) {
    throw new Error('Slot not found');
  }
  return slot;
}

function assertStatus(booking, expectedStatus) {
  if (booking.status !== expectedStatus) {
    throw new Error(`Booking must be ${expectedStatus}`);
  }
}

function pushLog(data, type, message) {
  data.auditLogs.unshift({
    id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type,
    message,
    at: new Date().toISOString()
  });
  data.auditLogs = data.auditLogs.slice(0, 50);
}

module.exports = {
  createParkingService,
  calculateFee,
  canFit,
  normalizeVehicleType
};
