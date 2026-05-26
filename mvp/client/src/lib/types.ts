export type Role = 'madriga' | 'substitute';

export interface User {
  id: string;
  role: Role;
  full_name: string;
  phone: string;
}

export type AbsenceStatus = 'open' | 'assigned' | 'cancelled';

export interface Absence {
  id: string;
  created_by: string;
  kindergarten_name: string;
  date: string;
  notes: string;
  status: AbsenceStatus;
  created_at: string;
  updated_at: string;
}

export interface Assignment {
  id: string;
  absence_id: string;
  substitute_id: string;
  claimed_at: string;
  status: 'active' | 'cancelled';
}

export interface Availability {
  id: string;
  substitute_id: string;
  date: string;
  is_available: boolean;
}

export interface SubstituteWithAvailability {
  id: string;
  full_name: string;
  phone: string;
  is_available: boolean | null;
}
