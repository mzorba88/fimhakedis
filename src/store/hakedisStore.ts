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
  mockUsers,
  defaultSubcontractors,
} from '@/data/mockData';
import { ActivityLog, ActivityType } from '@/types/activityLog';
import * as api from '@/services/supabaseService';

interface HakedisState {
  // Current user
  currentUser: User;
  setCurrentUser: (user: User) => void;
  setCurrentUserByRole: (role: UserRole) => void;

  // Projects
  projects: Project[];
  setProjects: (projects: Project[]) => void;
  addProject: (project: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project>;
  updateProject: (id: string, project: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Work Entries (Contracts)
  workEntries: WorkEntry[];
  setWorkEntries: (entries: WorkEntry[]) => void;
  addWorkEntry: (entry: Omit<WorkEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<WorkEntry>;
  updateWorkEntry: (id: string, entry: Partial<WorkEntry>) => Promise<void>;
  deleteWorkEntry: (id: string) => Promise<void>;
  approveEntry: (id: string, approvedBy: string) => Promise<void>;
  rejectEntry: (id: string, reason: string) => Promise<void>;
  markAsPaid: (id: string) => Promise<void>;
  getNextContractNo: () => Promise<string>;

  // Subcontractor Hakedisler
  subcontractorHakedisler: SubcontractorHakedis[];
  setSubcontractorHakedisler: (hakedisler: SubcontractorHakedis[]) => void;
  addSubcontractorHakedis: (hakedis: Omit<SubcontractorHakedis, 'id' | 'createdAt' | 'updatedAt'>) => Promise<SubcontractorHakedis>;
  updateSubcontractorHakedis: (id: string, hakedis: Partial<SubcontractorHakedis>) => Promise<void>;
  deleteSubcontractorHakedis: (id: string) => Promise<void>;
  approveHakedis: (id: string, approvedBy: string) => Promise<void>;
  rejectHakedis: (id: string, reason: string) => Promise<void>;
  markHakedisAsPaid: (id: string) => Promise<void>;

  // Subcontractors
  subcontractors: string[];
  setSubcontractors: (subcontractors: string[]) => void;
  addSubcontractor: (name: string) => Promise<void>;

  // Users
  users: User[];

  // Activity Logs
  activityLogs: ActivityLog[];
  setActivityLogs: (logs: ActivityLog[]) => void;
  addActivityLog: (type: ActivityType, description: string, details?: string, entityId?: string, entityType?: 'project' | 'contract' | 'hakedis') => Promise<void>;
}

export const useHakedisStore = create<HakedisState>((set, get) => ({
  // Initialize with empty data (will be loaded from database)
  currentUser: mockUsers[0],
  projects: [],
  workEntries: [],
  users: mockUsers,
  subcontractors: [],
  subcontractorHakedisler: [],
  activityLogs: [],

  setCurrentUser: (user) => set({ currentUser: user }),
  
  setCurrentUserByRole: (role) => {
    const user = mockUsers.find(u => u.role === role);
    if (user) set({ currentUser: user });
  },

  // Projects
  setProjects: (projects) => set({ projects }),
  
  addProject: async (projectData) => {
    const project = await api.createProject(projectData);
    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },
  
  updateProject: async (id, projectUpdate) => {
    await api.updateProject(id, projectUpdate);
    set((state) => ({
      projects: state.projects.map(p => 
        p.id === id ? { ...p, ...projectUpdate, updatedAt: new Date().toISOString() } : p
      )
    }));
  },
  
  deleteProject: async (id) => {
    await api.deleteProject(id);
    set((state) => ({
      projects: state.projects.filter(p => p.id !== id)
    }));
  },

  // Work Entries (Contracts)
  setWorkEntries: (entries) => set({ workEntries: entries }),
  
  getNextContractNo: async () => {
    return await api.getNextContractNo();
  },

  addWorkEntry: async (entryData) => {
    const entry = await api.createContract(entryData as any);
    set((state) => ({ workEntries: [entry, ...state.workEntries] }));
    return entry;
  },
  
  updateWorkEntry: async (id, entryUpdate) => {
    await api.updateContract(id, entryUpdate);
    set((state) => ({
      workEntries: state.workEntries.map(we => 
        we.id === id ? { ...we, ...entryUpdate, updatedAt: new Date().toISOString() } : we
      )
    }));
  },

  deleteWorkEntry: async (id) => {
    await api.deleteContract(id);
    set((state) => ({
      workEntries: state.workEntries.filter(we => we.id !== id)
    }));
  },
  
  approveEntry: async (id, approvedBy) => {
    const updates = { 
      approvalStatus: 'onaylandi' as ApprovalStatus, 
      approvedBy, 
      approvalDate: new Date().toISOString(),
    };
    await api.updateContract(id, updates);
    set((state) => ({
      workEntries: state.workEntries.map(we => 
        we.id === id 
          ? { ...we, ...updates, updatedAt: new Date().toISOString() } 
          : we
      )
    }));
  },
  
  rejectEntry: async (id, reason) => {
    const updates = { 
      approvalStatus: 'revize' as ApprovalStatus, 
      rejectionReason: reason,
    };
    await api.updateContract(id, updates);
    set((state) => ({
      workEntries: state.workEntries.map(we => 
        we.id === id 
          ? { ...we, ...updates, updatedAt: new Date().toISOString() } 
          : we
      )
    }));
  },
  
  markAsPaid: async (id) => {
    const updates = { 
      paymentStatus: 'odendi' as PaymentStatus, 
      paidDate: new Date().toISOString(),
    };
    await api.updateContract(id, updates);
    set((state) => ({
      workEntries: state.workEntries.map(we => 
        we.id === id 
          ? { ...we, ...updates, updatedAt: new Date().toISOString() } 
          : we
      )
    }));
  },

  // Subcontractor Hakedisler
  setSubcontractorHakedisler: (hakedisler) => set({ subcontractorHakedisler: hakedisler }),
  
  addSubcontractorHakedis: async (hakedisData) => {
    const hakedis = await api.createHakedis(hakedisData as any);
    set((state) => ({
      subcontractorHakedisler: [hakedis, ...state.subcontractorHakedisler]
    }));
    return hakedis;
  },

  updateSubcontractorHakedis: async (id, hakedisUpdate) => {
    await api.updateHakedis(id, hakedisUpdate);
    set((state) => ({
      subcontractorHakedisler: state.subcontractorHakedisler.map(h => 
        h.id === id ? { ...h, ...hakedisUpdate, updatedAt: new Date().toISOString() } : h
      )
    }));
  },

  deleteSubcontractorHakedis: async (id) => {
    await api.deleteHakedis(id);
    set((state) => ({
      subcontractorHakedisler: state.subcontractorHakedisler.filter(h => h.id !== id)
    }));
  },

  approveHakedis: async (id, approvedBy) => {
    const updates = { 
      approvalStatus: 'onaylandi' as ApprovalStatus, 
      approvedBy, 
      approvalDate: new Date().toISOString(),
    };
    await api.updateHakedis(id, updates);
    set((state) => ({
      subcontractorHakedisler: state.subcontractorHakedisler.map(h => 
        h.id === id 
          ? { ...h, ...updates, updatedAt: new Date().toISOString() } 
          : h
      )
    }));
  },

  rejectHakedis: async (id, reason) => {
    const updates = { 
      approvalStatus: 'revize' as ApprovalStatus, 
      rejectionReason: reason,
    };
    await api.updateHakedis(id, updates);
    set((state) => ({
      subcontractorHakedisler: state.subcontractorHakedisler.map(h => 
        h.id === id 
          ? { ...h, ...updates, updatedAt: new Date().toISOString() } 
          : h
      )
    }));
  },

  markHakedisAsPaid: async (id) => {
    const updates = { 
      paymentStatus: 'odendi' as PaymentStatus, 
      paidDate: new Date().toISOString(),
    };
    await api.updateHakedis(id, updates);
    set((state) => ({
      subcontractorHakedisler: state.subcontractorHakedisler.map(h => 
        h.id === id 
          ? { ...h, ...updates, updatedAt: new Date().toISOString() } 
          : h
      )
    }));
  },

  // Subcontractors
  setSubcontractors: (subcontractors) => set({ subcontractors }),
  
  addSubcontractor: async (name) => {
    await api.addSubcontractor(name);
    set((state) => ({
      subcontractors: [...state.subcontractors, name].sort()
    }));
  },

  // Activity Logs
  setActivityLogs: (logs) => set({ activityLogs: logs }),
  
  addActivityLog: async (type, description, details, entityId, entityType) => {
    const state = get();
    await api.createActivityLog(
      type, 
      roleLabels[state.currentUser.role], 
      description, 
      details, 
      entityId, 
      entityType
    );
    // Refresh logs from database
    const logs = await api.fetchActivityLogs();
    set({ activityLogs: logs });
  },
}));
