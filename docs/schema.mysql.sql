CREATE TABLE users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(160) UNIQUE,
  role ENUM('driver', 'admin') NOT NULL DEFAULT 'driver',
  priority ENUM('standard', 'vip') NOT NULL DEFAULT 'standard',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE slots (
  slot_id VARCHAR(12) PRIMARY KEY,
  zone VARCHAR(40) NOT NULL,
  floor_number INT NOT NULL,
  vehicle_type ENUM('motorcycle', 'sedan', 'suv', 'truck') NOT NULL,
  distance_index INT NOT NULL,
  status ENUM('available', 'reserved', 'occupied', 'maintenance') NOT NULL DEFAULT 'available',
  current_vehicle VARCHAR(20),
  reserved_at TIMESTAMP NULL,
  INDEX idx_slots_allocation (status, vehicle_type, distance_index)
);

CREATE TABLE bookings (
  booking_id VARCHAR(40) PRIMARY KEY,
  user_id INT,
  slot_id VARCHAR(12) NOT NULL,
  driver_name VARCHAR(120) NOT NULL,
  vehicle_number VARCHAR(20) NOT NULL,
  vehicle_type ENUM('motorcycle', 'sedan', 'suv', 'truck') NOT NULL,
  priority ENUM('standard', 'vip') NOT NULL DEFAULT 'standard',
  status ENUM('reserved', 'active', 'completed', 'cancelled', 'expired') NOT NULL,
  reserved_at TIMESTAMP NOT NULL,
  checked_in_at TIMESTAMP NULL,
  checked_out_at TIMESTAMP NULL,
  fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (slot_id) REFERENCES slots(slot_id),
  INDEX idx_booking_vehicle_status (vehicle_number, status),
  INDEX idx_booking_slot_status (slot_id, status)
);

CREATE TABLE audit_logs (
  log_id VARCHAR(40) PRIMARY KEY,
  event_type VARCHAR(40) NOT NULL,
  message VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
