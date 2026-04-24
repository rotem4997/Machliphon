-- ============================================
-- MACHLIPHON DATABASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AUTHORITIES (רשויות מקומיות)
-- ============================================
CREATE TABLE IF NOT EXISTS authorities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  name_en VARCHAR(255),
  city VARCHAR(255) NOT NULL,
  district VARCHAR(100), -- מחוז
  contact_name VARCHAR(255),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USERS (משתמשים - כל הסוגים)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  authority_id UUID REFERENCES authorities(id) ON DELETE SET NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('substitute', 'manager', 'authority_admin', 'super_admin')),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- KINDERGARTENS (גני ילדים)
-- ============================================
CREATE TABLE IF NOT EXISTS kindergartens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  authority_id UUID NOT NULL REFERENCES authorities(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(500),
  neighborhood VARCHAR(100), -- שכונה
  principal_name VARCHAR(255),
  phone VARCHAR(20),
  age_group VARCHAR(50), -- 0-3, 3-6, mixed
  capacity INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MANAGERS (מדריכות גנים)
-- ============================================
CREATE TABLE IF NOT EXISTS managers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  authority_id UUID NOT NULL REFERENCES authorities(id),
  employee_id VARCHAR(50), -- מספר עובד
  region VARCHAR(100), -- אזור אחריות
  managed_kindergartens_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- manager_kindergartens - קשר many-to-many
CREATE TABLE IF NOT EXISTS manager_kindergartens (
  manager_id UUID REFERENCES managers(id) ON DELETE CASCADE,
  kindergarten_id UUID REFERENCES kindergartens(id) ON DELETE CASCADE,
  PRIMARY KEY (manager_id, kindergarten_id)
);

-- ============================================
-- SUBSTITUTES (מחליפות)
-- ============================================
CREATE TABLE IF NOT EXISTS substitutes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  authority_id UUID NOT NULL REFERENCES authorities(id),
  id_number VARCHAR(9) UNIQUE NOT NULL, -- תעודת זהות
  birth_date DATE,
  address VARCHAR(500),
  neighborhood VARCHAR(100),
  -- Work permit (תיק עובד)
  work_permit_valid BOOLEAN DEFAULT false,
  work_permit_expiry DATE,
  work_permit_number VARCHAR(50),
  -- Qualifications
  education_level VARCHAR(50), -- תואר, עוזרת, מטפלת
  teaching_license_url VARCHAR(500), -- uploaded file path
  years_experience INTEGER DEFAULT 0,
  -- Availability
  available_days JSONB DEFAULT '["Sunday","Monday","Tuesday","Wednesday","Thursday"]',
  preferred_neighborhoods JSONB DEFAULT '[]',
  max_distance_km INTEGER DEFAULT 5,
  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending_approval')),
  rating DECIMAL(3,2) DEFAULT 0,
  total_assignments INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ABSENCE REPORTS (דיווחי היעדרות)
-- ============================================
CREATE TABLE IF NOT EXISTS absence_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kindergarten_id UUID NOT NULL REFERENCES kindergartens(id),
  reported_by UUID NOT NULL REFERENCES users(id),
  absent_employee_name VARCHAR(255) NOT NULL,
  absent_employee_role VARCHAR(50) DEFAULT 'teacher', -- teacher, assistant
  absence_date DATE NOT NULL,
  absence_reason VARCHAR(50), -- sick, vacation, emergency, known
  notes TEXT,
  -- Status tracking
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'covered', 'uncovered')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ASSIGNMENTS (שיבוצים)
-- ============================================
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  absence_id UUID REFERENCES absence_reports(id),
  substitute_id UUID NOT NULL REFERENCES substitutes(id),
  kindergarten_id UUID NOT NULL REFERENCES kindergartens(id),
  assigned_by UUID NOT NULL REFERENCES users(id), -- מי שיבץ
  assignment_date DATE NOT NULL,
  start_time TIME DEFAULT '07:30',
  end_time TIME DEFAULT '14:00',
  -- Status
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show')),
  substitute_confirmed_at TIMESTAMPTZ,
  substitute_arrived_at TIMESTAMPTZ,
  -- Hours for madganet
  hours_worked DECIMAL(4,2),
  hourly_rate DECIMAL(8,2),
  total_pay DECIMAL(10,2),
  -- Notes
  notes TEXT,
  cancellation_reason TEXT,
  rating DECIMAL(2,1) CHECK (rating >= 1 AND rating <= 5),
  rating_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUBSTITUTE AVAILABILITY (זמינות יומית)
-- ============================================
CREATE TABLE IF NOT EXISTS substitute_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  substitute_id UUID NOT NULL REFERENCES substitutes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  reason VARCHAR(255), -- vacation, sick, personal
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(substitute_id, date)
);

-- ============================================
-- KNOWN ABSENCES (חופשים ידועים מראש)
-- ============================================
CREATE TABLE IF NOT EXISTS known_absences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kindergarten_id UUID NOT NULL REFERENCES kindergartens(id),
  employee_name VARCHAR(255) NOT NULL,
  employee_role VARCHAR(50) DEFAULT 'teacher',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason VARCHAR(100), -- maternity, sabbatical, military, vacation
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS (התראות)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL, -- assignment_request, assignment_confirmed, permit_expiring, etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MADGANET EXPORTS (ייצוא למדגנט)
-- ============================================
CREATE TABLE IF NOT EXISTS madganet_exports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  authority_id UUID NOT NULL REFERENCES authorities(id),
  exported_by UUID NOT NULL REFERENCES users(id),
  export_month INTEGER NOT NULL, -- 1-12
  export_year INTEGER NOT NULL,
  assignments_count INTEGER DEFAULT 0,
  total_hours DECIMAL(8,2) DEFAULT 0,
  file_name VARCHAR(255),
  exported_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_authority ON users(authority_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_kindergartens_authority ON kindergartens(authority_id);
CREATE INDEX IF NOT EXISTS idx_substitutes_authority ON substitutes(authority_id);
CREATE INDEX IF NOT EXISTS idx_substitutes_status ON substitutes(status);
CREATE INDEX IF NOT EXISTS idx_assignments_date ON assignments(assignment_date);
CREATE INDEX IF NOT EXISTS idx_assignments_substitute ON assignments(substitute_id);
CREATE INDEX IF NOT EXISTS idx_assignments_kindergarten ON assignments(kindergarten_id);
CREATE INDEX IF NOT EXISTS idx_absence_reports_date ON absence_reports(absence_date);
CREATE INDEX IF NOT EXISTS idx_absence_reports_status ON absence_reports(status);
CREATE INDEX IF NOT EXISTS idx_availability_date ON substitute_availability(date);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- ============================================
-- UPDATED_AT trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_authorities_updated_at ON authorities;
CREATE TRIGGER update_authorities_updated_at BEFORE UPDATE ON authorities FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_kindergartens_updated_at ON kindergartens;
CREATE TRIGGER update_kindergartens_updated_at BEFORE UPDATE ON kindergartens FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_substitutes_updated_at ON substitutes;
CREATE TRIGGER update_substitutes_updated_at BEFORE UPDATE ON substitutes FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_assignments_updated_at ON assignments;
CREATE TRIGGER update_assignments_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_absence_reports_updated_at ON absence_reports;
CREATE TRIGGER update_absence_reports_updated_at BEFORE UPDATE ON absence_reports FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
