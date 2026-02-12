import * as XLSX from 'xlsx';
import { 
  formatCurrencyWithType, 
  formatDate, 
  contractTypeLabels, 
  approvalStatusLabels, 
  paymentStatusLabels, 
  hakedisTypeLabels,
  WorkEntry, 
  SubcontractorHakedis, 
  Project, 
  Currency 
} from '@/types/hakedis';
import { toast } from 'sonner';

const dateStr = () => new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');

export function exportContractsToExcel(
  entries: WorkEntry[], 
  projects: Project[],
  hakedisler: SubcontractorHakedis[]
) {
  const wb = XLSX.utils.book_new();

  const header = [
    '#', 'Sözleşme No', 'Proje', 'İş Kalemi', 'Altyüklenici', 
    'Sözleşme Tipi', 'Sözleşme Tutarı', 'Hakediş Toplamı', 
    'Ödenen Tutar', 'Kalan Bakiye', 'Para Birimi', 
    'Onay Durumu', 'Ödeme Durumu', 'Tarih'
  ];

  const data = entries.map((entry, idx) => {
    const project = projects.find(p => p.id === entry.projectId);
    const relatedHakedisler = hakedisler.filter(h => h.contractId === entry.id && h.approvalStatus === 'onaylandi');
    const hakedisTotal = relatedHakedisler.reduce((sum, h) => sum + h.totalAmount, 0);
    const paidTotal = relatedHakedisler.reduce((sum, h) => sum + (h.paidAmount || 0), 0);
    const remaining = hakedisTotal - paidTotal;

    return [
      idx + 1,
      entry.contractNo,
      project ? `${project.projectCode} - ${project.projectName}` : '-',
      entry.workCategory,
      entry.subcontractor,
      contractTypeLabels[entry.contractType],
      entry.totalAmount,
      hakedisTotal,
      paidTotal,
      remaining,
      entry.currency,
      approvalStatusLabels[entry.approvalStatus],
      paymentStatusLabels[entry.paymentStatus],
      formatDate(entry.date),
    ];
  });

  // Summary
  const totalContract = entries.reduce((s, e) => s + e.totalAmount, 0);
  const totalHakedis = entries.reduce((s, e) => {
    return s + hakedisler.filter(h => h.contractId === e.id && h.approvalStatus === 'onaylandi').reduce((sum, h) => sum + h.totalAmount, 0);
  }, 0);
  const totalPaid = entries.reduce((s, e) => {
    return s + hakedisler.filter(h => h.contractId === e.id && h.approvalStatus === 'onaylandi').reduce((sum, h) => sum + (h.paidAmount || 0), 0);
  }, 0);

  const allData = [
    ['ALTYÜKLENICI SÖZLEŞMELERİ RAPORU'],
    [`Rapor Tarihi: ${formatDate(new Date().toISOString())}`],
    [],
    header,
    ...data,
    [],
    ['ÖZET'],
    ['Toplam Sözleşme Tutarı', totalContract],
    ['Toplam Hakediş Tutarı', totalHakedis],
    ['Toplam Ödenen', totalPaid],
    ['Toplam Kalan Bakiye', totalHakedis - totalPaid],
  ];

  const ws = XLSX.utils.aoa_to_sheet(allData);
  ws['!cols'] = [
    { wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 20 }, { wch: 20 },
    { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Sözleşmeler');
  XLSX.writeFile(wb, `sozlesmeler-${dateStr()}.xlsx`);
  toast.success('Sözleşmeler Excel raporu indirildi');
}

export function exportHakedislerToExcel(
  hakedisler: SubcontractorHakedis[], 
  projects: Project[],
  contracts: WorkEntry[]
) {
  const wb = XLSX.utils.book_new();

  const header = [
    '#', 'Hakediş No', 'Hakediş Tipi', 'Proje', 'Sözleşme No', 'Altyüklenici',
    'Sözleşme Tutarı', 'Hakediş Tutarı', 'Ödenen Tutar', 'Kalan Bakiye',
    'Para Birimi', 'Onay Durumu', 'Ödeme Durumu', 'Tarih'
  ];

  const data = hakedisler.map((h, idx) => {
    const project = projects.find(p => p.id === h.projectId);
    const contract = contracts.find(c => c.id === h.contractId);
    const remaining = h.totalAmount - (h.paidAmount || 0);

    return [
      idx + 1,
      h.hakedisNo,
      hakedisTypeLabels[h.hakedisType],
      project ? `${project.projectCode} - ${project.projectName}` : '-',
      h.contractNo,
      h.subcontractor,
      contract?.totalAmount || 0,
      h.totalAmount,
      h.paidAmount || 0,
      remaining,
      h.currency,
      approvalStatusLabels[h.approvalStatus],
      paymentStatusLabels[h.paymentStatus],
      formatDate(h.date),
    ];
  });

  const totalContract = hakedisler.reduce((s, h) => {
    const contract = contracts.find(c => c.id === h.contractId);
    return s + (contract?.totalAmount || 0);
  }, 0);
  const totalHakedis = hakedisler.reduce((s, h) => s + h.totalAmount, 0);
  const totalPaid = hakedisler.reduce((s, h) => s + (h.paidAmount || 0), 0);

  const allData = [
    ['ALTYÜKLENICI HAKEDİŞLERİ RAPORU'],
    [`Rapor Tarihi: ${formatDate(new Date().toISOString())}`],
    [],
    header,
    ...data,
    [],
    ['ÖZET'],
    ['Toplam Sözleşme Tutarı', totalContract],
    ['Toplam Hakediş Tutarı', totalHakedis],
    ['Toplam Ödenen', totalPaid],
    ['Toplam Kalan Bakiye', totalHakedis - totalPaid],
  ];

  const ws = XLSX.utils.aoa_to_sheet(allData);
  ws['!cols'] = [
    { wch: 5 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 20 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Hakedişler');
  XLSX.writeFile(wb, `hakedisler-${dateStr()}.xlsx`);
  toast.success('Hakedişler Excel raporu indirildi');
}

export function exportPaymentsToExcel(
  hakedisler: SubcontractorHakedis[], 
  projects: Project[],
  contracts: WorkEntry[]
) {
  const wb = XLSX.utils.book_new();

  const header = [
    '#', 'Hakediş No', 'Proje', 'Sözleşme No', 'Altyüklenici',
    'Sözleşme Tutarı', 'Hakediş Tutarı', 'Ödenen Tutar', 'Kalan Bakiye',
    'Para Birimi', 'Ödeme Durumu', 'Onay Tarihi', 'Ödeme Tarihi'
  ];

  const data = hakedisler.map((h, idx) => {
    const project = projects.find(p => p.id === h.projectId);
    const contract = contracts.find(c => c.id === h.contractId);
    const remaining = h.totalAmount - (h.paidAmount || 0);

    return [
      idx + 1,
      h.hakedisNo,
      project ? `${project.projectCode} - ${project.projectName}` : '-',
      h.contractNo,
      h.subcontractor,
      contract?.totalAmount || 0,
      h.totalAmount,
      h.paidAmount || 0,
      remaining,
      h.currency,
      paymentStatusLabels[h.paymentStatus],
      h.approvalDate ? formatDate(h.approvalDate) : '-',
      h.paidDate ? formatDate(h.paidDate) : '-',
    ];
  });

  const totalContract = hakedisler.reduce((s, h) => {
    const contract = contracts.find(c => c.id === h.contractId);
    return s + (contract?.totalAmount || 0);
  }, 0);
  const totalHakedis = hakedisler.reduce((s, h) => s + h.totalAmount, 0);
  const totalPaid = hakedisler.reduce((s, h) => s + (h.paidAmount || 0), 0);

  const allData = [
    ['ÖDEME RAPORU'],
    [`Rapor Tarihi: ${formatDate(new Date().toISOString())}`],
    [],
    header,
    ...data,
    [],
    ['ÖZET'],
    ['Toplam Sözleşme Tutarı', totalContract],
    ['Toplam Hakediş Tutarı', totalHakedis],
    ['Toplam Ödenen', totalPaid],
    ['Toplam Kalan Bakiye', totalHakedis - totalPaid],
  ];

  const ws = XLSX.utils.aoa_to_sheet(allData);
  ws['!cols'] = [
    { wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 20 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Ödemeler');
  XLSX.writeFile(wb, `odemeler-${dateStr()}.xlsx`);
  toast.success('Ödemeler Excel raporu indirildi');
}
