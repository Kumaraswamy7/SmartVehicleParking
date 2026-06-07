# Smart Vehicle Parking System

A practical working model for **Smart Vehicle Parking System with Real-Time Slot Allocation**.

This MVP converts the project report and presentation into a real demo that professors, interviewers, and stakeholders can operate live:

- Real-time parking slot status using Server-Sent Events.
- Dynamic Slot Allocation Algorithm based on vehicle type, VIP priority, and nearest slot distance.
- Driver booking flow: reserve, check in, check out, cancel.
- Admin control panel for maintenance and release overrides.
- Persistent local data store with MySQL-ready schema documentation.
- Automated tests for allocation, lifecycle, and billing rules.

## Run

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Test

```bash
npm test
```

## Demo Credentials

The MVP uses a demo-first flow, so no password is required. Enter any driver name and vehicle number in the dashboard.

## Architecture

```text
Browser UI
  -> REST API for booking/admin actions
  -> Event stream for real-time slot updates
Node.js service layer
  -> Dynamic Slot Allocation Algorithm
  -> Booking lifecycle and billing
  -> Reservation timeout worker
JSON data store for demo persistence
  -> Designed to migrate to MySQL tables: users, slots, bookings, audit_logs
```

## Production Upgrade Path

The code is structured so the JSON store can be replaced by MySQL without changing the UI:

- `src/store.js`: replace JSON persistence with MySQL queries and transactions.
- `src/parkingService.js`: keep business rules and allocation logic.
- `src/server.js`: keep API contracts for web and mobile clients.

