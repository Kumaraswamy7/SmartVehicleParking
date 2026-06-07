const test = require('node:test');
const assert = require('node:assert/strict');
const { createParkingService, calculateFee, canFit } = require('../src/parkingService');
const { createSeedData } = require('../src/seed');

function memoryStore(seed = createSeedData()) {
  let data = JSON.parse(JSON.stringify(seed));
  return {
    read: () => data,
    write: (next) => {
      data = JSON.parse(JSON.stringify(next));
    },
    reset: () => {
      data = createSeedData();
    }
  };
}

test('standard sedan receives nearest general compatible slot', () => {
  const service = createParkingService(memoryStore(), {
    now: () => new Date('2026-06-07T10:00:00.000Z')
  });

  const result = service.allocateSlot({
    driverName: 'Test Driver',
    vehicleNumber: 'TS09AB1234',
    vehicleType: 'sedan',
    priority: 'standard'
  });

  assert.equal(result.slot.id, 'A01');
  assert.equal(result.slot.status, 'reserved');
  assert.equal(result.booking.status, 'reserved');
});

test('VIP driver is prioritized into VIP zone when a VIP slot is available', () => {
  const service = createParkingService(memoryStore(), {
    now: () => new Date('2026-06-07T10:00:00.000Z')
  });

  const result = service.allocateSlot({
    driverName: 'VIP Driver',
    vehicleNumber: 'TS09VIP7777',
    vehicleType: 'sedan',
    priority: 'vip'
  });

  assert.equal(result.slot.id, 'C01');
  assert.equal(result.slot.zone, 'VIP');
});

test('duplicate active booking for same vehicle is rejected', () => {
  const service = createParkingService(memoryStore(), {
    now: () => new Date('2026-06-07T10:00:00.000Z')
  });

  service.allocateSlot({
    driverName: 'First Driver',
    vehicleNumber: 'TS09AA1111',
    vehicleType: 'suv'
  });

  assert.throws(() => service.allocateSlot({
    driverName: 'Second Driver',
    vehicleNumber: 'TS09AA1111',
    vehicleType: 'suv'
  }), /active booking/);
});

test('booking lifecycle moves slot from reserved to occupied to available', () => {
  let current = new Date('2026-06-07T10:00:00.000Z');
  const service = createParkingService(memoryStore(), {
    now: () => current
  });

  const reservation = service.allocateSlot({
    driverName: 'Lifecycle Driver',
    vehicleNumber: 'TS09LC2222',
    vehicleType: 'sedan'
  });

  current = new Date('2026-06-07T10:05:00.000Z');
  const checkIn = service.checkIn(reservation.booking.id);
  assert.equal(checkIn.booking.status, 'active');
  assert.equal(checkIn.slot.status, 'occupied');

  current = new Date('2026-06-07T11:15:00.000Z');
  const checkOut = service.checkOut(reservation.booking.id);
  assert.equal(checkOut.booking.status, 'completed');
  assert.equal(checkOut.slot.status, 'available');
  assert.equal(checkOut.booking.fee, 90);
});

test('expired reservation is released automatically', () => {
  let current = new Date('2026-06-07T10:00:00.000Z');
  const service = createParkingService(memoryStore(), {
    now: () => current,
    reservationTimeoutMs: 15 * 60 * 1000
  });

  service.allocateSlot({
    driverName: 'Late Driver',
    vehicleNumber: 'TS09LT3333',
    vehicleType: 'sedan'
  });

  current = new Date('2026-06-07T10:16:00.000Z');
  const state = service.releaseExpiredReservations();

  assert.equal(state.stats.reserved, 0);
  assert.equal(state.stats.available, createSeedData().slots.length);
  assert.equal(state.bookings[0].status, 'expired');
});

test('vehicle compatibility and billing rules are deterministic', () => {
  assert.equal(canFit('truck', 'sedan'), true);
  assert.equal(canFit('sedan', 'truck'), false);
  assert.equal(calculateFee('2026-06-07T10:00:00.000Z', '2026-06-07T10:01:00.000Z'), 55);
  assert.equal(calculateFee('2026-06-07T10:00:00.000Z', '2026-06-07T12:01:00.000Z'), 125);
});
