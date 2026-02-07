import { create } from 'zustand';
import { 
  Project, 
  WorkEntry, 
  User, 
  UserRole,
  ApprovalStatus,
  PaymentStatus,
  ProjectStatus,
  SubcontractorHakedis,
  roleLabels
} from '@/types/hakedis';
import { 
  mockProjects, 
  mockWorkEntries, 
  mockUsers,
  defaultSubcontractors,
  mockSubcontractorHakedisler
} from '@/data/mockData';
import { ActivityLog, ActivityType } from '@/types/activityLog';

interface HakedisState {
  // Current user
  currentUser: User;
  setCurrentUser: (user: User) => void;
  setCurrentUserByRole: (role: UserRole) => void;

  // Projects
  projects: Project[];
  addProject: (project: Project) => void;
  updateProject: (id: string, project: Partial<Project>) => void;
  deleteProject: (id: string) => void;

  // Work Entries (Contracts)
  workEntries: WorkEntry[];
  contractCounter: number;
  addWorkEntry: (entry: WorkEntry) => void;
  updateWorkEntry: (id: string, entry: Partial<WorkEntry>) => void;
  deleteWorkEntry: (id: string) => void;
  approveEntry: (id: string, approvedBy: string) => void;
  rejectEntry: (id: string, reason: string) => void;
  markAsPaid: (id: string) => void;
  getNextContractNo: () => string;

  // Subcontractor Hakedisler
  subcontractorHakedisler: SubcontractorHakedis[];
  addSubcontractorHakedis: (hakedis: SubcontractorHakedis) => void;
  deleteSubcontractorHakedis: (id: string) => void;
  approveHakedis: (id: string, approvedBy: string) => void;
  rejectHakedis: (id: string, reason: string) => void;
  markHakedisAsPaid: (id: string) => void;

  // Subcontractors
  subcontractors: string[];
  addSubcontractor: (name: string) => void;

  // Users
  users: User[];

  // Activity Logs
  activityLogs: ActivityLog[];
  addActivityLog: (type: ActivityType, description: string, details?: string, entityId?: string, entityType?: 'project' | 'contract' | 'hakedis') => void;
}

export const useHakedisStore = create<HakedisState>((set, get) => ({
  // Initialize with mock data
  currentUser: mockUsers[0],
  projects: mockProjects,
  workEntries: mockWorkEntries,
  users: mockUsers,
  subcontractors: defaultSubcontractors,
  contractCounter: 1005,
  subcontractorHakedisler: mockSubcontractorHakedisler,
  activityLogs: [],

  setCurrentUser: (user) => set({ currentUser: user }),
  
  setCurrentUserByRole: (role) => {
    const user = mockUsers.find(u => u.role === role);
    if (user) set({ currentUser: user });
  },

  // Projects
  addProject: (project) => set((state) => ({ 
    projects: [...state.projects, project] 
  })),
  
  updateProject: (id, projectUpdate) => set((state) => ({
    projects: state.projects.map(p => 
      p.id === id ? { ...p, ...projectUpdate, updatedAt: new Date().toISOString() } : p
    )
  })),
  
  deleteProject: (id) => set((state) => ({
    projects: state.projects.filter(p => p.id !== id)
  })),

  // Work Entries (Contracts)
  getNextContractNo: () => {
    const state = get();
    const nextNo = state.contractCounter + 1;
    set({ contractCounter: nextNo });
    return `SZ-${nextNo}`;
  },

  addWorkEntry: (entry) => set((state) => ({ 
    workEntries: [...state.workEntries, entry] 
  })),
  
  updateWorkEntry: (id, entryUpdate) => set((state) => ({
    workEntries: state.workEntries.map(we => 
      we.id === id ? { ...we, ...entryUpdate, updatedAt: new Date().toISOString() } : we
    )
  })),

  deleteWorkEntry: (id) => set((state) => ({
    workEntries: state.workEntries.filter(we => we.id !== id)
  })),
  
  approveEntry: (id, approvedBy) => set((state) => ({
    workEntries: state.workEntries.map(we => 
      we.id === id 
        ? { 
            ...we, 
            approvalStatus: 'onaylandi' as ApprovalStatus, 
            approvedBy, 
            approvalDate: new Date().toISOString(),
            updatedAt: new Date().toISOString() 
          } 
        : we
    )
  })),
  
  rejectEntry: (id, reason) => set((state) => ({
    workEntries: state.workEntries.map(we => 
      we.id === id 
        ? { 
            ...we, 
            approvalStatus: 'revize' as ApprovalStatus, 
            rejectionReason: reason,
            updatedAt: new Date().toISOString() 
          } 
        : we
    )
  })),
  
  markAsPaid: (id) => set((state) => ({
    workEntries: state.workEntries.map(we => 
      we.id === id 
        ? { 
            ...we, 
            paymentStatus: 'odendi' as PaymentStatus, 
            paidDate: new Date().toISOString(),
            updatedAt: new Date().toISOString() 
          } 
        : we
    )
  })),

  // Subcontractor Hakedisler
  addSubcontractorHakedis: (hakedis) => set((state) => ({
    subcontractorHakedisler: [...state.subcontractorHakedisler, hakedis]
  })),

  deleteSubcontractorHakedis: (id) => set((state) => ({
    subcontractorHakedisler: state.subcontractorHakedisler.filter(h => h.id !== id)
  })),

  approveHakedis: (id, approvedBy) => set((state) => ({
    subcontractorHakedisler: state.subcontractorHakedisler.map(h => 
      h.id === id 
        ? { 
            ...h, 
            approvalStatus: 'onaylandi' as ApprovalStatus, 
            approvedBy, 
            approvalDate: new Date().toISOString(),
            updatedAt: new Date().toISOString() 
          } 
        : h
    )
  })),

  rejectHakedis: (id, reason) => set((state) => ({
    subcontractorHakedisler: state.subcontractorHakedisler.map(h => 
      h.id === id 
        ? { 
            ...h, 
            approvalStatus: 'revize' as ApprovalStatus, 
            rejectionReason: reason,
            updatedAt: new Date().toISOString() 
          } 
        : h
    )
  })),

  markHakedisAsPaid: (id) => set((state) => ({
    subcontractorHakedisler: state.subcontractorHakedisler.map(h => 
      h.id === id 
        ? { 
            ...h, 
            paymentStatus: 'odendi' as PaymentStatus, 
            paidDate: new Date().toISOString(),
            updatedAt: new Date().toISOString() 
          } 
        : h
    )
  })),

  // Subcontractors
  addSubcontractor: (name) => set((state) => ({
    subcontractors: [...state.subcontractors, name].sort()
  })),

  // Activity Logs
  addActivityLog: (type, description, details, entityId, entityType) => {
    const state = get();
    const newLog: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      userId: state.currentUser.id,
      userName: state.currentUser.name,
      userRole: roleLabels[state.currentUser.role],
      description,
      details,
      entityId,
      entityType,
      timestamp: new Date().toISOString(),
    };
    set({ activityLogs: [...state.activityLogs, newLog] });
  },
}));
