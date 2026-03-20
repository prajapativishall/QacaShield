CREATE DATABASE IF NOT EXISTS qacashield CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE qacashield;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  role ENUM('USER','MANAGER','ADMIN') DEFAULT 'USER',
  home_lat DECIMAL(10,7),
  home_lng DECIMAL(10,7),
  created_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tasks (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  title VARCHAR(200) NOT NULL,
  status ENUM('PENDING','ACTIVE','COMPLETED') DEFAULT 'PENDING',
  created_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_tasks_user_id (user_id),
  CONSTRAINT fk_tasks_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assignments (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  assigned_by INT UNSIGNED NULL,
  origin_lat DECIMAL(10,7),
  origin_lng DECIMAL(10,7),
  dest_lat DECIMAL(10,7),
  dest_lng DECIMAL(10,7),
  destination_address VARCHAR(255),
  home_lat DECIMAL(10,7),
  home_lng DECIMAL(10,7),
  route_polyline LONGTEXT,
  helmet_image_url VARCHAR(255),
  helmet_start_image_url VARCHAR(255),
  helmet_return_image_url VARCHAR(255),
  is_safety_verified TINYINT(1) DEFAULT 0,
  exit_reason TEXT,
  task_title VARCHAR(200),
  priority ENUM('LOW','MEDIUM','HIGH') DEFAULT 'MEDIUM',
  geofence_radius INT DEFAULT 100,
  route_optimization ENUM('FASTEST','SAFEST') DEFAULT 'FASTEST',
  expected_start_time DATETIME NULL,
  buffer_time INT DEFAULT 15,
  actual_start_time DATETIME NULL,
  actual_end_time DATETIME NULL,
  arrival_time DATETIME NULL,
  arrival_lat DECIMAL(10,7),
  arrival_lng DECIMAL(10,7),
  return_time DATETIME NULL,
  completed_lat DECIMAL(10,7),
  completed_lng DECIMAL(10,7),
  current_lat DECIMAL(10,7),
  current_lng DECIMAL(10,7),
  current_phase ENUM(
    'PLANNED',
    'PENDING',
    'ACCEPTED',
    'ACTIVE',
    'REACHED_DESTINATION',
    'RETURNING_HOME',
    'FINALIZED',
    'COMPLETED',
    'CANCELLED'
  ) DEFAULT 'PENDING',
  active TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_assignments_user_id (user_id),
  CONSTRAINT fk_assignments_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS assignment_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT UNSIGNED NOT NULL,
  type VARCHAR(50) NOT NULL,
  message VARCHAR(500) NOT NULL,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  created_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_assignment_logs_assignment_id (assignment_id),
  CONSTRAINT fk_assignment_logs_assignment FOREIGN KEY (assignment_id) REFERENCES assignments(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  manager_id INT UNSIGNED NOT NULL,
  subject VARCHAR(200) NOT NULL,
  meta_json JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
