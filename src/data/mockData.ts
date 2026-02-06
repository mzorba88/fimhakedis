import { 
  Project, 
  WorkItem, 
  Milestone, 
  WorkEntry, 
  User,
  DashboardStats 
} from '@/types/hakedis';

export const mockUsers: User[] = [
  { id: 'u1', name: 'Ahmet Yılmaz', role: 'saha_sorumlusu', email: 'ahmet@example.com' },
  { id: 'u2', name: 'Mehmet Kaya', role: 'direktor', email: 'mehmet@example.com' },
  { id: 'u3', name: 'Ayşe Demir', role: 'muhasebe', email: 'ayse@example.com' },
];

export const mockProjects: Project[] = [
  {
    id: 'p1',
    projectName: 'Kadıköy Metro İstasyonu İnşaatı',
    projectCode: 'KDK-2024-001',
    contractType: 'birim_fiyat',
    subcontractorName: 'ABC İnşaat Ltd. Şti.',
    subcontractorTaxId: '1234567890',
    totalContractValue: 15000000,
    startDate: '2024-01-15',
    endDate: '2025-06-30',
    description: 'Kadıköy metro istasyonu ve bağlantı tünelleri inşaatı',
    createdAt: '2024-01-10',
    updatedAt: '2024-01-10',
  },
  {
    id: 'p2',
    projectName: 'Ataşehir Ofis Binası',
    projectCode: 'ATH-2024-002',
    contractType: 'goturu_bedel',
    subcontractorName: 'XYZ Yapı A.Ş.',
    subcontractorTaxId: '0987654321',
    totalContractValue: 8500000,
    startDate: '2024-02-01',
    endDate: '2024-12-31',
    description: '10 katlı ofis binası inşaatı',
    createdAt: '2024-01-25',
    updatedAt: '2024-01-25',
  },
  {
    id: 'p3',
    projectName: 'Beşiktaş Altyapı Yenileme',
    projectCode: 'BSK-2024-003',
    contractType: 'birim_fiyat',
    subcontractorName: 'DEF Mühendislik',
    subcontractorTaxId: '5678901234',
    totalContractValue: 4200000,
    startDate: '2024-03-01',
    description: 'Beşiktaş ilçesi altyapı yenileme çalışmaları',
    createdAt: '2024-02-20',
    updatedAt: '2024-02-20',
  },
];

export const mockWorkItems: WorkItem[] = [
  // Kadıköy Metro Project Items
  { id: 'wi1', projectId: 'p1', itemCode: 'KZI-001', description: 'Kazı işleri', unit: 'm³', unitPrice: 85, contractQuantity: 50000 },
  { id: 'wi2', projectId: 'p1', itemCode: 'BET-001', description: 'Beton dökümü C30', unit: 'm³', unitPrice: 450, contractQuantity: 15000 },
  { id: 'wi3', projectId: 'p1', itemCode: 'DMR-001', description: 'Demir işleri', unit: 'ton', unitPrice: 12000, contractQuantity: 800 },
  { id: 'wi4', projectId: 'p1', itemCode: 'KLP-001', description: 'Kalıp işleri', unit: 'm²', unitPrice: 120, contractQuantity: 35000 },
  
  // Beşiktaş Altyapı Items
  { id: 'wi5', projectId: 'p3', itemCode: 'BOR-001', description: 'Kanalizasyon borusu döşeme', unit: 'm', unitPrice: 350, contractQuantity: 5000 },
  { id: 'wi6', projectId: 'p3', itemCode: 'ASF-001', description: 'Asfalt kaplama', unit: 'm²', unitPrice: 95, contractQuantity: 20000 },
  { id: 'wi7', projectId: 'p3', itemCode: 'TRT-001', description: 'Tretuvar döşeme', unit: 'm²', unitPrice: 180, contractQuantity: 8000 },
];

export const mockMilestones: Milestone[] = [
  // Ataşehir Ofis Building Milestones
  { id: 'm1', projectId: 'p2', name: 'Temel Kazı ve Beton', description: 'Temel kazı ve beton işleri', percentage: 15, amount: 1275000, order: 1 },
  { id: 'm2', projectId: 'p2', name: 'Kaba İnşaat', description: 'Taşıyıcı sistem ve kaba inşaat', percentage: 35, amount: 2975000, order: 2 },
  { id: 'm3', projectId: 'p2', name: 'Çatı ve Cephe', description: 'Çatı ve dış cephe kaplaması', percentage: 20, amount: 1700000, order: 3 },
  { id: 'm4', projectId: 'p2', name: 'Mekanik Tesisat', description: 'Mekanik ve elektrik tesisat', percentage: 15, amount: 1275000, order: 4 },
  { id: 'm5', projectId: 'p2', name: 'İç Dekorasyon', description: 'İç dekorasyon ve finish', percentage: 10, amount: 850000, order: 5 },
  { id: 'm6', projectId: 'p2', name: 'Teslim', description: 'Son kontroller ve teslim', percentage: 5, amount: 425000, order: 6 },
];

export const mockWorkEntries: WorkEntry[] = [
  // Approved and Paid
  {
    id: 'we1',
    projectId: 'p1',
    workItemId: 'wi1',
    quantity: 5000,
    description: 'Ocak ayı kazı işleri',
    date: '2024-01-31',
    createdBy: 'u1',
    approvalStatus: 'onaylandi',
    approvedBy: 'u2',
    approvalDate: '2024-02-02',
    subtotal: 425000,
    vatAmount: 85000,
    totalAmount: 510000,
    paymentStatus: 'odendi',
    paidDate: '2024-02-15',
    createdAt: '2024-01-31',
    updatedAt: '2024-02-15',
  },
  {
    id: 'we2',
    projectId: 'p1',
    workItemId: 'wi2',
    quantity: 1500,
    description: 'Şubat ayı beton dökümü',
    date: '2024-02-28',
    createdBy: 'u1',
    approvalStatus: 'onaylandi',
    approvedBy: 'u2',
    approvalDate: '2024-03-01',
    subtotal: 675000,
    vatAmount: 135000,
    totalAmount: 810000,
    paymentStatus: 'odendi',
    paidDate: '2024-03-10',
    createdAt: '2024-02-28',
    updatedAt: '2024-03-10',
  },
  // Approved but Unpaid
  {
    id: 'we3',
    projectId: 'p1',
    workItemId: 'wi3',
    quantity: 100,
    description: 'Mart ayı demir işleri',
    date: '2024-03-31',
    createdBy: 'u1',
    approvalStatus: 'onaylandi',
    approvedBy: 'u2',
    approvalDate: '2024-04-02',
    subtotal: 1200000,
    vatAmount: 240000,
    totalAmount: 1440000,
    paymentStatus: 'odenmedi',
    createdAt: '2024-03-31',
    updatedAt: '2024-04-02',
  },
  // Pending Approval
  {
    id: 'we4',
    projectId: 'p1',
    workItemId: 'wi4',
    quantity: 4000,
    description: 'Nisan ayı kalıp işleri',
    date: '2024-04-30',
    createdBy: 'u1',
    approvalStatus: 'onay_bekliyor',
    subtotal: 480000,
    vatAmount: 96000,
    totalAmount: 576000,
    paymentStatus: 'odenmedi',
    createdAt: '2024-04-30',
    updatedAt: '2024-04-30',
  },
  // Götürü Bedel entries
  {
    id: 'we5',
    projectId: 'p2',
    milestoneId: 'm1',
    completionPercentage: 100,
    description: 'Temel kazı ve beton işleri tamamlandı',
    date: '2024-03-15',
    createdBy: 'u1',
    approvalStatus: 'onaylandi',
    approvedBy: 'u2',
    approvalDate: '2024-03-17',
    subtotal: 1275000,
    vatAmount: 255000,
    totalAmount: 1530000,
    paymentStatus: 'odendi',
    paidDate: '2024-03-25',
    createdAt: '2024-03-15',
    updatedAt: '2024-03-25',
  },
  {
    id: 'we6',
    projectId: 'p2',
    milestoneId: 'm2',
    completionPercentage: 60,
    description: 'Kaba inşaat %60 tamamlandı',
    date: '2024-04-20',
    createdBy: 'u1',
    approvalStatus: 'onay_bekliyor',
    subtotal: 1785000,
    vatAmount: 357000,
    totalAmount: 2142000,
    paymentStatus: 'odenmedi',
    createdAt: '2024-04-20',
    updatedAt: '2024-04-20',
  },
  // Revised entry
  {
    id: 'we7',
    projectId: 'p3',
    workItemId: 'wi5',
    quantity: 800,
    description: 'Kanalizasyon borusu döşeme - Mayıs',
    date: '2024-05-15',
    createdBy: 'u1',
    approvalStatus: 'revize',
    rejectionReason: 'Miktar belgeleri eksik, lütfen iş teslim tutanağını ekleyin.',
    subtotal: 280000,
    vatAmount: 56000,
    totalAmount: 336000,
    paymentStatus: 'odenmedi',
    createdAt: '2024-05-15',
    updatedAt: '2024-05-18',
  },
];

export const calculateDashboardStats = (): DashboardStats => {
  const approvedEntries = mockWorkEntries.filter(e => e.approvalStatus === 'onaylandi');
  const paidEntries = approvedEntries.filter(e => e.paymentStatus === 'odendi');
  const pendingEntries = mockWorkEntries.filter(e => e.approvalStatus === 'onay_bekliyor');

  const totalContractValue = mockProjects.reduce((sum, p) => sum + p.totalContractValue, 0);
  const approvedTotal = approvedEntries.reduce((sum, e) => sum + e.totalAmount, 0);
  const paidTotal = paidEntries.reduce((sum, e) => sum + e.totalAmount, 0);

  return {
    totalProjects: mockProjects.length,
    pendingApprovals: pendingEntries.length,
    approvedTotal,
    paidTotal,
    remainingBalance: totalContractValue - paidTotal,
    thisMonthApproved: approvedTotal * 0.3, // Mock data for this month
    thisMonthPaid: paidTotal * 0.25,
  };
};
