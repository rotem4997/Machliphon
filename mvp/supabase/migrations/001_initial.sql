-- ============================================================
-- MVP MIGRATION 001 — Machliphon MVP (מחליפון)
-- Run this in Supabase SQL editor or via supabase db push
-- ============================================================

-- -------------------------------------------------------
-- users (profile table, mirrors auth.users)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('madriga', 'substitute')),
  full_name   TEXT NOT NULL,
  phone       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- absences (היעדרויות)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.absences (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by         UUID NOT NULL REFERENCES public.users(id),
  kindergarten_name  TEXT NOT NULL,
  date               DATE NOT NULL,
  notes              TEXT,
  status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'cancelled')),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- assignments (שיבוצים)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  absence_id     UUID NOT NULL REFERENCES public.absences(id) ON DELETE CASCADE,
  substitute_id  UUID NOT NULL REFERENCES public.users(id),
  claimed_at     TIMESTAMPTZ DEFAULT NOW(),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  UNIQUE (absence_id) -- only one active assignment per absence at a time
);

-- -------------------------------------------------------
-- availability (זמינות יומית של מחליפות)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  substitute_id  UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date           DATE NOT NULL,
  is_available   BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (substitute_id, date)
);

-- -------------------------------------------------------
-- sms_notifications (לוג SMS שנשלחו)
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sms_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  absence_id  UUID NOT NULL REFERENCES public.absences(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id),
  phone       TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- -------------------------------------------------------
-- Indexes
-- -------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_absences_date   ON public.absences(date);
CREATE INDEX IF NOT EXISTS idx_absences_status ON public.absences(status);
CREATE INDEX IF NOT EXISTS idx_availability_sub_date ON public.availability(substitute_id, date);
CREATE INDEX IF NOT EXISTS idx_sms_absence ON public.sms_notifications(absence_id);

-- -------------------------------------------------------
-- updated_at trigger for absences
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS absences_updated_at ON public.absences;
CREATE TRIGGER absences_updated_at
  BEFORE UPDATE ON public.absences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------------------------------
-- Row Level Security
-- -------------------------------------------------------
ALTER TABLE public.users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_notifications ENABLE ROW LEVEL SECURITY;

-- users: everyone reads their own row; server (service_role) writes
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (auth.uid() = id);

-- madriga reads all users (to list substitutes)
CREATE POLICY "madriga_select_all_users" ON public.users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'madriga')
  );

-- absences: madriga full access; substitute read-only (open only)
CREATE POLICY "madriga_all_absences" ON public.absences
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'madriga')
  );

CREATE POLICY "substitute_read_open_absences" ON public.absences
  FOR SELECT USING (
    status = 'open'
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'substitute')
  );

-- assignments: madriga full; substitute sees their own
CREATE POLICY "madriga_all_assignments" ON public.assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'madriga')
  );

CREATE POLICY "substitute_own_assignments" ON public.assignments
  FOR ALL USING (substitute_id = auth.uid());

-- availability: substitute manages own; madriga reads all
CREATE POLICY "substitute_own_availability" ON public.availability
  FOR ALL USING (substitute_id = auth.uid());

CREATE POLICY "madriga_read_availability" ON public.availability
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'madriga')
  );

-- sms_notifications: madriga reads all; server inserts via service_role
CREATE POLICY "madriga_read_sms" ON public.sms_notifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'madriga')
  );
