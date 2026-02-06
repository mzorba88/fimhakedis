// Altyüklenici Hakediş Sistemi - Type Definitions

export type UserRole = 'saha_sorumlusu' | 'direktor' | 'muhasebe';

export type ContractType = 'goturu_bedel' | 'birim_fiyat';

export type ApprovalStatus = 'onay_bekliyor' | 'onaylandi' | 'revize';

export type PaymentStatus = 'odendi' | 'odenmedi';

export type ProjectStatus = 'aktif' | 'tamamlandi';

export type Currency = 'TRY' | 'USD' | 'EUR' | 'GBP';

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
  location: string;
  startDate: string;
  status: ProjectStatus;
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

// Payment installment for Götürü Bedel
export interface PaymentInstallment {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  dueDate?: string;
  isPaid: boolean;
}

// Work item entry for Birim Fiyat
export interface WorkItemEntry {
  id: string;
  workCategory: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  currency: Currency;
}

// Work Entry (Yapılan İş / Altyüklenici Sözleşmesi)
export interface WorkEntry {
  id: string;
  contractNo: string; // Auto-generated contract number
  projectId: string;
  workCategory: string;
  subcontractor: string;
  contractType: ContractType;
  contractFile?: string;
  date: string;
  currency: Currency;
  // For Götürü Bedel
  paymentPlan?: PaymentInstallment[];
  // For Birim Fiyat
  workItemEntries?: WorkItemEntry[];
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

// Altyüklenici Hakediş (Subcontractor Progress Payment)
export interface SubcontractorHakedis {
  id: string;
  hakedisNo: string; // Auto-generated hakediş number
  projectId: string;
  subcontractor: string;
  contractId: string; // Reference to WorkEntry (contract)
  contractNo: string;
  contractType: ContractType;
  currency: Currency;
  date: string;
  // For Götürü Bedel - payment amount
  paymentAmount?: number;
  // For Birim Fiyat - work items with quantities
  hakedisItems?: HakedisItem[];
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  createdBy: string;
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  approvalDate?: string;
  rejectionReason?: string;
  paymentStatus: PaymentStatus;
  paidDate?: string;
  createdAt: string;
  updatedAt: string;
}

// Hakediş item for Birim Fiyat contracts
export interface HakedisItem {
  id: string;
  workItemEntryId: string;
  workCategory: string;
  description: string;
  unit: string;
  unitPrice: number;
  quantity: number; // Quantity for this hakediş
  amount: number;
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

export const projectStatusLabels: Record<ProjectStatus, string> = {
  aktif: 'Aktif',
  tamamlandi: 'Tamamlandı',
};

export const currencySymbols: Record<Currency, string> = {
  TRY: '₺',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export const roleLabels: Record<UserRole, string> = {
  saha_sorumlusu: 'Saha Sorumlusu',
  direktor: 'Direktör',
  muhasebe: 'Muhasebe',
};

// Work categories list
export const workCategories = [
  'Ahşap',
  'Alçı Saten Sıva',
  'Alçıpan',
  'Aluminyum ve Cam',
  'Altyapı',
  'Aplikasyon',
  'Beton Döküm',
  'Boya ve Dekorasyon',
  'Cephe Kaplama',
  'Çelik İşleri',
  'Çatı İşleri',
  'Betonarme Demir İşçilik',
  'Dozer, Kazı ve Hafriyat',
  'Dolgu İşleri',
  'Döşeme Kaplama İşleri',
  'Elektrik İşleri',
  'Forklift İşleri',
  'Su İzolasyon',
  'Kalıp İşleri',
  'Karot İşleri',
  'Kuyu Kazı',
  'Laminant Parke',
  'Mantolama',
  'Mekanik Sıhhi Tesiat İşleri',
  'Mekanik Isıtma Soğutma İşleri',
  'Mekanik Havalandırma İşleri',
  'Mekanik İşler',
  'Seramik ve Mermer İşçilik',
  'Nakliye İşleri',
  'Beton Parke İşleri',
  'Peyzaj İşleri',
  'Çimento Sıva İşleri',
  'Sulama İşleri',
  'Şap Beton İşleri',
  'Şömine İşleri',
  'Taş Duvar İşleri',
  'Temizlik İşleri',
  'Tuğla Duvar İşleri',
  'Yapı İşleri',
  'Yapısal Çelik İşleri',
  'Zayıf Akım Elektrik İşleri',
];

// Format currency with specific currency type
export const formatCurrencyWithType = (amount: number, currency: Currency): string => {
  const locales: Record<Currency, string> = {
    TRY: 'tr-TR',
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
  };
  return new Intl.NumberFormat(locales[currency], {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
};
