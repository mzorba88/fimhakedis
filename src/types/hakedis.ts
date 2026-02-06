// Altyüklenici Hakediş Sistemi - Type Definitions

export type UserRole = 'saha_sorumlusu' | 'direktor' | 'muhasebe';

export type ContractType = 'goturu_bedel' | 'birim_fiyat';

export type ApprovalStatus = 'onay_bekliyor' | 'onaylandi' | 'revize';

export type PaymentStatus = 'odendi' | 'odenmedi';

export interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

export interface Project {
  id: string;
  projectName: string;
  projectCode: string;
  contractType: ContractType;
  subcontractorName: string;
  subcontractorTaxId?: string;
  totalContractValue: number;
  startDate: string;
  endDate?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// For Birim Fiyat (Unit Price) contracts
export interface WorkItem {
  id: string;
  projectId: string;
  itemCode: string;
  description: string;
  unit: string;
  unitPrice: number;
  contractQuantity: number;
}

// For Götürü Bedel (Lump Sum) contracts
export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  percentage: number;
  amount: number;
  order: number;
}

// Work Entry (Yapılan İş)
export interface WorkEntry {
  id: string;
  projectId: string;
  workItemId?: string; // For Birim Fiyat
  milestoneId?: string; // For Götürü Bedel
  quantity?: number; // For Birim Fiyat
  completionPercentage?: number; // For Götürü Bedel
  description: string;
  date: string;
  createdBy: string;
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  approvalDate?: string;
  rejectionReason?: string;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paidDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HakedisReport {
  id: string;
  projectId: string;
  reportNumber: number;
  periodStart: string;
  periodEnd: string;
  previousTotal: number;
  currentPeriodTotal: number;
  cumulativeTotal: number;
  vatAmount: number;
  grandTotal: number;
  createdAt: string;
  createdBy: string;
  entries: WorkEntry[];
}

export interface DashboardStats {
  totalProjects: number;
  pendingApprovals: number;
  approvedTotal: number;
  paidTotal: number;
  remainingBalance: number;
  thisMonthApproved: number;
  thisMonthPaid: number;
}

// Helper function to calculate VAT (20%)
export const calculateVAT = (subtotal: number): number => {
  return subtotal * 0.20;
};

// Helper function to calculate total with VAT
export const calculateTotalWithVAT = (subtotal: number): number => {
  return subtotal + calculateVAT(subtotal);
};

// Format currency in Turkish Lira
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 2,
  }).format(amount);
};

// Format date in Turkish locale
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

// Status labels in Turkish
export const approvalStatusLabels: Record<ApprovalStatus, string> = {
  onay_bekliyor: 'Onay Bekliyor',
  onaylandi: 'Onaylandı',
  revize: 'Revize Gerekli',
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  odendi: 'Ödendi',
  odenmedi: 'Ödenmedi',
};

export const contractTypeLabels: Record<ContractType, string> = {
  goturu_bedel: 'Götürü Bedel',
  birim_fiyat: 'Birim Fiyat',
};

export const roleLabels: Record<UserRole, string> = {
  saha_sorumlusu: 'Saha Sorumlusu',
  direktor: 'Direktör',
  muhasebe: 'Muhasebe',
};
