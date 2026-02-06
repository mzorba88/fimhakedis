import { create } from 'zustand';
import { 
  Project, 
  WorkEntry, 
  User, 
  UserRole,
  ApprovalStatus,
  PaymentStatus,
  ProjectStatus
} from '@/types/hakedis';
import { 
  mockProjects, 
  mockWorkEntries, 
  mockUsers,
  defaultSubcontractors
} from '@/data/mockData';

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

  // Work Entries
  workEntries: WorkEntry[];
  addWorkEntry: (entry: WorkEntry) => void;
  updateWorkEntry: (id: string, entry: Partial<WorkEntry>) => void;
  approveEntry: (id: string, approvedBy: string) => void;
  rejectEntry: (id: string, reason: string) => void;
  markAsPaid: (id: string) => void;

  // Subcontractors
  subcontractors: string[];
  addSubcontractor: (name: string) => void;

  // Users
  users: User[];
}

export const useHakedisStore = create<HakedisState>((set, get) => ({
  // Initialize with mock data
  currentUser: mockUsers[0],
  projects: mockProjects,
  workEntries: mockWorkEntries,
  users: mockUsers,
  subcontractors: defaultSubcontractors,

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

  // Work Entries
  addWorkEntry: (entry) => set((state) => ({ 
    workEntries: [...state.workEntries, entry] 
  })),
  
  updateWorkEntry: (id, entryUpdate) => set((state) => ({
    workEntries: state.workEntries.map(we => 
      we.id === id ? { ...we, ...entryUpdate, updatedAt: new Date().toISOString() } : we
    )
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

  // Subcontractors
  addSubcontractor: (name) => set((state) => ({
    subcontractors: [...state.subcontractors, name]
  })),
}));
