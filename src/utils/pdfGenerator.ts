import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { 
  WorkEntry, 
  SubcontractorHakedis, 
  Project,
  formatCurrencyWithType,
  formatDate,
  contractTypeLabels
} from '@/types/hakedis';

// Extend jsPDF type for autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

// Turkish character replacement for PDF (jsPDF default fonts don't support Turkish)
const replaceTurkishChars = (text: string): string => {
  const charMap: Record<string, string> = {
    'ı': 'i', 'İ': 'I', 'ş': 's', 'Ş': 'S', 
    'ğ': 'g', 'Ğ': 'G', 'ü': 'u', 'Ü': 'U',
    'ö': 'o', 'Ö': 'O', 'ç': 'c', 'Ç': 'C'
  };
  return text.replace(/[ışğüöçİŞĞÜÖÇ]/g, char => charMap[char] || char);
};

export const generateContractPDF = (
  entry: WorkEntry, 
  project: Project | undefined,
  subcontractorHakedisler: SubcontractorHakedis[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(replaceTurkishChars('Altyüklenici Sözleşme Raporu'), pageWidth / 2, 20, { align: 'center' });
  
  // Contract info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(replaceTurkishChars(`Sözleşme No: ${entry.contractNo}`), 14, 35);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  let yPos = 45;
  const leftCol = 14;
  const rightCol = 110;
  
  // Left column
  doc.text(replaceTurkishChars(`Proje: ${project?.projectName || '-'}`), leftCol, yPos);
  doc.text(replaceTurkishChars(`Proje Kodu: ${project?.projectCode || '-'}`), leftCol, yPos + 7);
  doc.text(replaceTurkishChars(`Altyüklenici: ${entry.subcontractor}`), leftCol, yPos + 14);
  doc.text(replaceTurkishChars(`İş Kalemi: ${entry.workCategory}`), leftCol, yPos + 21);
  
  // Right column
  doc.text(replaceTurkishChars(`Tarih: ${formatDate(entry.date)}`), rightCol, yPos);
  doc.text(replaceTurkishChars(`Sözleşme Tipi: ${contractTypeLabels[entry.contractType]}`), rightCol, yPos + 7);
  doc.text(replaceTurkishChars(`Para Birimi: ${entry.currency}`), rightCol, yPos + 14);
  if (entry.vatRate) {
    doc.text(replaceTurkishChars(`KDV Oranı: %${entry.vatRate}`), rightCol, yPos + 21);
  }
  
  yPos += 35;
  
  // Contract details based on type
  if (entry.contractType === 'goturu_bedel' && entry.paymentPlan && entry.paymentPlan.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text(replaceTurkishChars('Ödeme Planı'), leftCol, yPos);
    yPos += 5;
    
    const paymentData = entry.paymentPlan.map((p, idx) => [
      (idx + 1).toString(),
      replaceTurkishChars(p.description || '-'),
      formatCurrencyWithType(p.amount, entry.currency),
      p.isPaid ? 'Odendi' : 'Odenmedi'
    ]);
    
    doc.autoTable({
      startY: yPos,
      head: [['#', replaceTurkishChars('Açıklama'), 'Tutar', 'Durum']],
      body: paymentData,
      theme: 'striped',
      headStyles: { fillColor: [66, 66, 66] },
      margin: { left: 14, right: 14 }
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
  } else if (entry.contractType === 'birim_fiyat' && entry.workItemEntries && entry.workItemEntries.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text(replaceTurkishChars('İş Kalemleri'), leftCol, yPos);
    yPos += 5;
    
    const itemData = entry.workItemEntries.map((item, idx) => [
      (idx + 1).toString(),
      replaceTurkishChars(item.description || item.workCategory),
      item.unit,
      item.quantity.toString(),
      formatCurrencyWithType(item.unitPrice, entry.currency),
      formatCurrencyWithType(item.quantity * item.unitPrice, entry.currency)
    ]);
    
    doc.autoTable({
      startY: yPos,
      head: [['#', replaceTurkishChars('Açıklama'), 'Birim', 'Miktar', 'Birim Fiyat', 'Toplam']],
      body: itemData,
      theme: 'striped',
      headStyles: { fillColor: [66, 66, 66] },
      margin: { left: 14, right: 14 }
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
  }
  
  // Financial summary
  doc.setFont('helvetica', 'bold');
  doc.text(replaceTurkishChars('Mali Özet'), leftCol, yPos);
  yPos += 7;
  
  doc.setFont('helvetica', 'normal');
  const subtotal = entry.totalAmount;
  const vatAmount = entry.vatRate ? subtotal * (entry.vatRate / 100) : 0;
  const totalWithVat = subtotal + vatAmount;
  
  doc.text(replaceTurkishChars(`Ara Toplam: ${formatCurrencyWithType(subtotal, entry.currency)}`), leftCol, yPos);
  yPos += 7;
  
  if (entry.vatRate) {
    doc.text(replaceTurkishChars(`KDV (%${entry.vatRate}): ${formatCurrencyWithType(vatAmount, entry.currency)}`), leftCol, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'bold');
    doc.text(replaceTurkishChars(`KDV Dahil Toplam: ${formatCurrencyWithType(totalWithVat, entry.currency)}`), leftCol, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
  }
  
  // Payment status for götürü bedel
  if (entry.contractType === 'goturu_bedel') {
    const paidAmount = subcontractorHakedisler
      .filter(h => h.contractId === entry.id)
      .reduce((sum, h) => sum + h.totalAmount, 0);
    const remainingBalance = entry.totalAmount - paidAmount;
    
    yPos += 5;
    doc.text(replaceTurkishChars(`Ödenen Miktar: ${formatCurrencyWithType(paidAmount, entry.currency)}`), leftCol, yPos);
    yPos += 7;
    doc.text(replaceTurkishChars(`Kalan Bakiye: ${formatCurrencyWithType(remainingBalance, entry.currency)}`), leftCol, yPos);
  }
  
  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text(replaceTurkishChars(`Oluşturma Tarihi: ${new Date().toLocaleString('tr-TR')}`), leftCol, pageHeight - 10);
  
  // Save
  doc.save(`Sozlesme_${entry.contractNo}_${formatDate(entry.date)}.pdf`);
};

export const generateHakedisPDF = (
  hakedis: SubcontractorHakedis,
  project: Project | undefined,
  contract: WorkEntry | undefined,
  subcontractorHakedisler: SubcontractorHakedis[]
) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(replaceTurkishChars('Altyüklenici Hakediş Raporu'), pageWidth / 2, 20, { align: 'center' });
  
  // Hakedis info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(replaceTurkishChars(`Hakediş No: ${hakedis.hakedisNo}`), 14, 35);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  
  let yPos = 45;
  const leftCol = 14;
  const rightCol = 110;
  
  // Left column
  doc.text(replaceTurkishChars(`Proje: ${project?.projectName || '-'}`), leftCol, yPos);
  doc.text(replaceTurkishChars(`Proje Kodu: ${project?.projectCode || '-'}`), leftCol, yPos + 7);
  doc.text(replaceTurkishChars(`Altyüklenici: ${hakedis.subcontractor}`), leftCol, yPos + 14);
  doc.text(replaceTurkishChars(`Sözleşme No: ${hakedis.contractNo}`), leftCol, yPos + 21);
  
  // Right column
  doc.text(replaceTurkishChars(`Tarih: ${formatDate(hakedis.date)}`), rightCol, yPos);
  doc.text(replaceTurkishChars(`Sözleşme Tipi: ${contractTypeLabels[hakedis.contractType]}`), rightCol, yPos + 7);
  doc.text(replaceTurkishChars(`Para Birimi: ${hakedis.currency}`), rightCol, yPos + 14);
  if (hakedis.vatRate) {
    doc.text(replaceTurkishChars(`KDV Oranı: %${hakedis.vatRate}`), rightCol, yPos + 21);
  }
  
  yPos += 35;
  
  // Hakediş details based on type
  if (hakedis.contractType === 'birim_fiyat' && hakedis.hakedisItems && hakedis.hakedisItems.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text(replaceTurkishChars('Hakediş Kalemleri'), leftCol, yPos);
    yPos += 5;
    
    const itemData = hakedis.hakedisItems.map((item, idx) => [
      (idx + 1).toString(),
      replaceTurkishChars(item.description || item.workCategory),
      item.unit,
      item.quantity.toString(),
      formatCurrencyWithType(item.unitPrice, hakedis.currency),
      formatCurrencyWithType(item.amount, hakedis.currency)
    ]);
    
    doc.autoTable({
      startY: yPos,
      head: [['#', replaceTurkishChars('Açıklama'), 'Birim', 'Miktar', 'Birim Fiyat', 'Tutar']],
      body: itemData,
      theme: 'striped',
      headStyles: { fillColor: [66, 66, 66] },
      margin: { left: 14, right: 14 }
    });
    
    yPos = doc.lastAutoTable.finalY + 10;
  }
  
  // Financial summary
  doc.setFont('helvetica', 'bold');
  doc.text(replaceTurkishChars('Mali Özet'), leftCol, yPos);
  yPos += 7;
  
  doc.setFont('helvetica', 'normal');
  const subtotal = hakedis.totalAmount;
  const vatAmount = hakedis.vatRate ? subtotal * (hakedis.vatRate / 100) : 0;
  const totalWithVat = subtotal + vatAmount;
  
  doc.text(replaceTurkishChars(`Hakediş Tutarı: ${formatCurrencyWithType(subtotal, hakedis.currency)}`), leftCol, yPos);
  yPos += 7;
  
  if (hakedis.vatRate) {
    doc.text(replaceTurkishChars(`KDV (%${hakedis.vatRate}): ${formatCurrencyWithType(vatAmount, hakedis.currency)}`), leftCol, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'bold');
    doc.text(replaceTurkishChars(`KDV Dahil Toplam: ${formatCurrencyWithType(totalWithVat, hakedis.currency)}`), leftCol, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
  }
  
  // Contract summary
  if (contract) {
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(replaceTurkishChars('Sözleşme Özeti'), leftCol, yPos);
    yPos += 7;
    doc.setFont('helvetica', 'normal');
    
    const contractTotal = contract.totalAmount;
    const allHakedisler = subcontractorHakedisler.filter(h => h.contractId === contract.id);
    const paidAmount = allHakedisler.reduce((sum, h) => sum + h.totalAmount, 0);
    
    doc.text(replaceTurkishChars(`Sözleşme Toplam: ${formatCurrencyWithType(contractTotal, contract.currency)}`), leftCol, yPos);
    yPos += 7;
    doc.text(replaceTurkishChars(`Toplam Hakediş: ${formatCurrencyWithType(paidAmount, contract.currency)}`), leftCol, yPos);
    
    if (contract.contractType === 'goturu_bedel') {
      yPos += 7;
      doc.text(replaceTurkishChars(`Kalan Bakiye: ${formatCurrencyWithType(contractTotal - paidAmount, contract.currency)}`), leftCol, yPos);
    }
  }
  
  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text(replaceTurkishChars(`Oluşturma Tarihi: ${new Date().toLocaleString('tr-TR')}`), leftCol, pageHeight - 10);
  
  // Save
  doc.save(`Hakedis_${hakedis.hakedisNo}_${formatDate(hakedis.date)}.pdf`);
};
