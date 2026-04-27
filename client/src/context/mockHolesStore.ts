import { create } from 'zustand';
import { MockAssignment } from '@/utils/mockData';

export interface TakenHole {
  date: string;
  kgId: string;
  kgName: string;
  kgAddress: string;
  neighborhood: string;
  subFirstName: string;
  subLastName: string;
  subPhone: string;
}

interface MockHolesState {
  takenHoles: TakenHole[];
  takeHole: (hole: TakenHole) => void;
  untakeHole: (date: string, kgId: string) => void;
  isHoleTaken: (date: string, kgId: string) => boolean;
  getTakenAsAssignments: () => MockAssignment[];
}

export const useMockHolesStore = create<MockHolesState>((set, get) => ({
  takenHoles: [],

  takeHole: (hole) =>
    set(state => {
      // Idempotent: don't add the same hole twice
      if (state.takenHoles.some(h => h.date === hole.date && h.kgId === hole.kgId)) {
        return state;
      }
      return { takenHoles: [...state.takenHoles, hole] };
    }),

  untakeHole: (date, kgId) =>
    set(state => ({
      takenHoles: state.takenHoles.filter(h => !(h.date === date && h.kgId === kgId)),
    })),

  isHoleTaken: (date, kgId) =>
    get().takenHoles.some(h => h.date === date && h.kgId === kgId),

  getTakenAsAssignments: (): MockAssignment[] =>
    get().takenHoles.map(h => ({
      id: `taken-${h.date}-${h.kgId}`,
      assignment_date: h.date,
      start_time: '07:30',
      end_time: '14:00',
      status: 'confirmed',
      kindergarten_id: h.kgId,
      kindergarten_name: h.kgName,
      kindergarten_address: h.kgAddress,
      neighborhood: h.neighborhood,
      substitute_first_name: h.subFirstName,
      substitute_last_name: h.subLastName,
      substitute_phone: h.subPhone,
      notes: null,
    })),
}));
