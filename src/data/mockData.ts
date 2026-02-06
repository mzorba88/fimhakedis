import { 
  Project, 
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
  { id: 'p1', projectCode: '578', projectName: 'GÜVEN SİGORTA OFİS BİNASI', location: 'KOĞLU, GİRNE', startDate: '2024-01-15', status: 'aktif', createdAt: '2024-01-10', updatedAt: '2024-01-10' },
  { id: 'p2', projectCode: '581', projectName: 'MUNUR ERKAL KONUT VE HAVUZ', location: 'YENİKENT, LEFKOŞA', startDate: '2024-01-20', status: 'aktif', createdAt: '2024-01-15', updatedAt: '2024-01-15' },
  { id: 'p3', projectCode: '583', projectName: 'WELLCARE LEFKOŞA', location: 'KERMİYA, LEFKOŞA', startDate: '2024-02-01', status: 'aktif', createdAt: '2024-01-25', updatedAt: '2024-01-25' },
  { id: 'p4', projectCode: '585', projectName: 'ANALİZ APARTMAN', location: 'KERMİYA, LEFKOŞA', startDate: '2024-02-10', status: 'aktif', createdAt: '2024-02-05', updatedAt: '2024-02-05' },
  { id: 'p5', projectCode: '588', projectName: 'ASBAN YATIRIM', location: 'ALAYKÖY, LEFKOŞA', startDate: '2024-02-15', status: 'aktif', createdAt: '2024-02-10', updatedAt: '2024-02-10' },
  { id: 'p6', projectCode: '590', projectName: 'PROLAB GİRNE', location: 'GİRNE', startDate: '2024-03-01', status: 'aktif', createdAt: '2024-02-25', updatedAt: '2024-02-25' },
  { id: 'p7', projectCode: '592', projectName: 'SEDA EMİNAĞA KONUT VE HAVUZ', location: 'GİRNE', startDate: '2024-03-10', status: 'aktif', createdAt: '2024-03-05', updatedAt: '2024-03-05' },
  { id: 'p8', projectCode: '594', projectName: 'MÜNİFE SEVİNÇ', location: 'GİRNE', startDate: '2024-03-15', status: 'aktif', createdAt: '2024-03-10', updatedAt: '2024-03-10' },
  { id: 'p9', projectCode: '595', projectName: 'BATARYACI DEPO', location: 'SANAYİ, LEFKOŞA', startDate: '2024-03-20', status: 'aktif', createdAt: '2024-03-15', updatedAt: '2024-03-15' },
  { id: 'p10', projectCode: '596', projectName: 'HASAN SARI KONUTU', location: 'HAMİTKÖY, LEFKOŞA', startDate: '2024-04-01', status: 'aktif', createdAt: '2024-03-25', updatedAt: '2024-03-25' },
  { id: 'p11', projectCode: '597', projectName: 'LÜTFİYE TARİMER KONUTU', location: 'YENİKENT', startDate: '2024-04-10', status: 'aktif', createdAt: '2024-04-05', updatedAt: '2024-04-05' },
  { id: 'p12', projectCode: '108', projectName: 'CUBRICK RESIDENCE', location: 'ORTAKÖY, LEFKOŞA', startDate: '2024-04-15', status: 'aktif', createdAt: '2024-04-10', updatedAt: '2024-04-10' },
];

// Default subcontractors list (alphabetically sorted)
export const defaultSubcontractors = [
  'AHMET KURT',
  'ALP KARDEŞLER',
  'ALUDENİZALP',
  'ARİF MEŞE',
  'BARA ELEKTRİK',
  'CUMA KUYUCU USTA',
  'DEMİRBAĞ',
  'EMSU BOYA',
  'HASAN KORUROĞLU',
  'HÜSEYİN USTA AHŞAP',
  'KARATAÇLAR',
  'KOCAKAYA POOLS',
  'MASSA',
  'MECHSYS',
  'MEHMET SEZER',
  'MUSTAFA ŞÖFÖRLER',
  'ÖNDER ALÇI DEKORASYON',
  'ÖZBİÇER ALUMİNYUM',
  'SERHAT USTA PARKE',
  'SERKAN ÖMERAĞA',
  'ŞİFO USTA',
  'TAHİR SEVGİL',
  'TÜRKAY SILALI',
  'YAŞAR SOYKAN',
];

export const mockWorkEntries: WorkEntry[] = [];

export const calculateDashboardStats = (projects: Project[], workEntries: WorkEntry[]): DashboardStats => {
  const approvedEntries = workEntries.filter(e => e.approvalStatus === 'onaylandi');
  const paidEntries = approvedEntries.filter(e => e.paymentStatus === 'odendi');
  const pendingEntries = workEntries.filter(e => e.approvalStatus === 'onay_bekliyor');

  const approvedTotal = approvedEntries.reduce((sum, e) => sum + e.totalAmount, 0);
  const paidTotal = paidEntries.reduce((sum, e) => sum + e.totalAmount, 0);

  return {
    totalProjects: projects.length,
    pendingApprovals: pendingEntries.length,
    approvedTotal,
    paidTotal,
    remainingBalance: approvedTotal - paidTotal,
    thisMonthApproved: approvedTotal * 0.3,
    thisMonthPaid: paidTotal * 0.25,
  };
};
