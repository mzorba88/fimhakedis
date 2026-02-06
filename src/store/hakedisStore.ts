import { create } from 'zustand';
import { 
  Project, 
  WorkItem, 
  Milestone, 
  WorkEntry, 
  User, 
  UserRole,
  ApprovalStatus,
  PaymentStatus 
} from '@/types/hakedis';
import { 
  mockProjects, 
  mockWorkItems, 
  mockMilestones, 
  mockWorkEntries, 
  mockUsers 
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

  // Work Items
  workItems: WorkItem[];
  addWorkItem: (item: WorkItem) => void;
  updateWorkItem: (id: string, item: Partial<WorkItem>) => void;

  // Milestones
  milestones: Milestone[];
  addMilestone: (milestone: Milestone) => void;
  updateMilestone: (id: string, milestone: Partial<Milestone>) => void;

  // Work Entries
  workEntries: WorkEntry[];
  addWorkEntry: (entry: WorkEntry) => void;
  updateWorkEntry: (id: string, entry: Partial<WorkEntry>) => void;
  approveEntry: (id: string, approvedBy: string) => void;
  rejectEntry: (id: string, reason: string) => void;
  markAsPaid: (id: string) => void;

  // Users
  users: User[];
}

export const useHakedisStore = create<HakedisState>((set, get) => ({
  // Initialize with mock data
  currentUser: mockUsers[0],
  projects: mockProjects,
  workItems: mockWorkItems,
  milestones: mockMilestones,
  workEntries: mockWorkEntries,
  users: mockUsers,

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

  // Work Items
  addWorkItem: (item) => set((state) => ({ 
    workItems: [...state.workItems, item] 
  })),
  
  updateWorkItem: (id, itemUpdate) => set((state) => ({
    workItems: state.workItems.map(wi => 
      wi.id === id ? { ...wi, ...itemUpdate } : wi
    )
  })),

  // Milestones
  addMilestone: (milestone) => set((state) => ({ 
    milestones: [...state.milestones, milestone] 
  })),
  
  updateMilestone: (id, milestoneUpdate) => set((state) => ({
    milestones: state.milestones.map(m => 
      m.id === id ? { ...m, ...milestoneUpdate } : m
    )
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
}));
