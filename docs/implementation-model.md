# Practical Implementation Model

## What This MVP Proves

This implementation demonstrates the complete software flow expected from the report:

1. A driver checks availability in real time.
2. The system allocates the best slot using DSAA.
3. The booking moves through reserved, checked-in, checked-out, cancelled, or expired states.
4. The admin dashboard sees occupancy, active sessions, revenue, and slot overrides.
5. Slot changes broadcast instantly to every open browser session.

## Dynamic Slot Allocation Algorithm

The allocator ranks slots using:

- Availability: only `available` slots can be selected.
- Vehicle compatibility: larger slots can support smaller vehicles.
- User priority: VIP users receive VIP slots first when possible.
- Distance index: nearest slot to exit/elevator is selected first.
- Deterministic tie-break: floor and slot ID.

This prevents double-booking because the service checks the slot status again immediately before mutation. In production, this same rule belongs inside a MySQL transaction:

```sql
START TRANSACTION;
SELECT * FROM slots
WHERE status = 'available'
  AND vehicle_type_rank >= ?
ORDER BY distance_index ASC
LIMIT 1
FOR UPDATE;

UPDATE slots
SET status = 'reserved', current_vehicle = ?, reserved_at = NOW()
WHERE slot_id = ? AND status = 'available';
COMMIT;
```

## Suggested Presentation Demo

1. Open the dashboard and point to live available/reserved/occupied counts.
2. Reserve a standard sedan and show the allocated general slot.
3. Reserve a VIP sedan and show that it goes to the VIP zone.
4. Check in one booking and show the slot turn occupied.
5. Check out and show revenue calculation.
6. Mark a free slot as maintenance from the admin panel.
7. Open the same URL in a second browser tab and show real-time updates.

## Production Roadmap

- Replace JSON store with MySQL 8.0 tables.
- Add JWT login and role-based access control.
- Connect ultrasonic/IR sensors through an IoT gateway endpoint.
- Add ANPR/RFID check-in automation.
- Add UPI/card payment gateway after check-out.
- Deploy behind Nginx with HTTPS and database backups.

