import { 
  WorkEntry, 
  SubcontractorHakedis, 
  Project,
  formatCurrencyWithType,
  formatDate,
  contractTypeLabels,
  hakedisTypeLabels,
  paymentStatusLabels,
  approvalStatusLabels
} from '@/types/hakedis';

const loadPdfLibs = async () => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  return { jsPDF, autoTable };
};

const COLORS = {
  primary: [59, 130, 246] as [number, number, number],
  indigo: [99, 102, 241] as [number, number, number],
  green: [34, 197, 94] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
  red: [220, 38, 38] as [number, number, number],
  gray: [107, 114, 128] as [number, number, number],
  lightGray: [249, 250, 251] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  dark: [26, 26, 26] as [number, number, number],
};

function addHeader(doc: any, title: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Title
  doc.setFontSize(16);
  doc.setTextColor(...COLORS.dark);
  doc.text(title, pageWidth / 2, 18, { align: 'center' });
  
  // Report date
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.text(`Rapor Tarihi: ${formatDate(new Date().toISOString())}`, pageWidth - 14, 18, { align: 'right' });
  
  // Line under header
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(14, 22, pageWidth - 14, 22);
  
  return 28;
}

function addSectionTitle(doc: any, title: string, y: number, color: [number, number, number] = COLORS.primary) {
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.dark);
  doc.text(title, 14, y);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.8);
  doc.line(14, y + 1.5, 80, y + 1.5);
  return y + 6;
}

function addSignatureBlock(doc: any, y: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const colWidth = (pageWidth - 28) / 2;
  
  y += 10;
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.dark);
  
  doc.text('Direktör Onayı:', 14 + colWidth / 2, y, { align: 'center' });
  doc.text('Muhasebe Onayı:', 14 + colWidth + colWidth / 2, y, { align: 'center' });
  
  y += 18;
  doc.setDrawColor(...COLORS.dark);
  doc.line(24, y, 24 + colWidth - 20, y);
  doc.line(14 + colWidth + 10, y, 14 + colWidth + colWidth - 10, y);
  
  y += 4;
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray);
  doc.text('İmza / Tarih', 14 + colWidth / 2, y, { align: 'center' });
  doc.text('İmza / Tarih', 14 + colWidth + colWidth / 2, y, { align: 'center' });
  
  return y;
}

export const generateContractPDF = async (
  entry: WorkEntry, 
  project: Project | undefined,
  subcontractorHakedisler: SubcontractorHakedis[]
) => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF('p', 'mm', 'a4');
  
  let y = addHeader(doc, 'ALTYÜKLENICI SÖZLEŞME RAPORU');

  // Contract Info
  y = addSectionTitle(doc, 'Sözleşme Bilgileri', y, COLORS.primary);
  
  autoTable(doc, {
    startY: y,
    body: [
      ['Sözleşme No', entry.contractNo, 'Proje', `${project?.projectCode || '-'} - ${project?.projectName || '-'}`],
      ['Altyüklenici', entry.subcontractor, 'İş Kalemi', entry.workCategory],
      ['Sözleşme Tipi', contractTypeLabels[entry.contractType], 'Tarih', formatDate(entry.date)],
      ['Onay Durumu', approvalStatusLabels[entry.approvalStatus], 'Ödeme Durumu', paymentStatusLabels[entry.paymentStatus]],
      ...(entry.description ? [['Açıklama', { content: entry.description, colSpan: 3 }]] : []),
    ],
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 }, 2: { fontStyle: 'bold', cellWidth: 30 } },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Work items for birim fiyat
  if (entry.contractType === 'birim_fiyat' && entry.workItemEntries?.length) {
    y = addSectionTitle(doc, 'İş Kalemleri', y, COLORS.indigo);
    autoTable(doc, {
      startY: y,
      head: [['#', 'Açıklama', 'Birim', 'Miktar', 'Birim Fiyat', 'Toplam']],
      body: entry.workItemEntries.map((item, idx) => [
        idx + 1,
        item.description || item.workCategory,
        item.unit,
        item.quantity,
        formatCurrencyWithType(item.unitPrice, entry.currency),
        formatCurrencyWithType(item.quantity * item.unitPrice, entry.currency),
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: COLORS.indigo, textColor: COLORS.white },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 15, halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Payment plan for götürü bedel
  if (entry.contractType === 'goturu_bedel' && entry.paymentPlan?.length) {
    y = addSectionTitle(doc, 'Ödeme Planı', y, COLORS.indigo);
    autoTable(doc, {
      startY: y,
      head: [['#', 'Açıklama', 'Tutar', 'Durum']],
      body: entry.paymentPlan.map((p, idx) => [
        idx + 1,
        p.description || '-',
        formatCurrencyWithType(p.amount, entry.currency),
        p.isPaid ? '✓ Ödendi' : '○ Ödenmedi',
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: COLORS.indigo, textColor: COLORS.white },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'center' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Financial summary
  const subtotal = entry.totalAmount;
  const vatAmount = entry.vatRate ? subtotal * (entry.vatRate / 100) : 0;
  const totalWithVat = subtotal + vatAmount;
  
  const approvedHakedisler = subcontractorHakedisler.filter(h => h.contractId === entry.id && h.approvalStatus === 'onaylandi');
  const totalHakedisAmount = approvedHakedisler.reduce((sum, h) => {
    const hVat = h.vatRate ? h.totalAmount * (h.vatRate / 100) : 0;
    return sum + h.totalAmount + hVat;
  }, 0);
  const paidAmount = approvedHakedisler.reduce((sum, h) => sum + (h.paidAmount || 0), 0);
  const remainingBalance = totalWithVat - paidAmount;

  y = addSectionTitle(doc, 'Tutar Bilgileri', y, COLORS.green);
  
  const financialRows: any[][] = [
    ['Sözleşme Tutarı (KDV Hariç)', formatCurrencyWithType(subtotal, entry.currency)],
  ];
  if (entry.vatRate) {
    financialRows.push([`KDV (%${entry.vatRate})`, formatCurrencyWithType(vatAmount, entry.currency)]);
  }
  financialRows.push(
    ['Sözleşme Tutarı (KDV Dahil)', formatCurrencyWithType(totalWithVat, entry.currency)],
    ['Toplam Hakediş Tutarı (KDV Dahil)', formatCurrencyWithType(totalHakedisAmount, entry.currency)],
    ['Ödenen Tutar (KDV Dahil)', formatCurrencyWithType(paidAmount, entry.currency)],
    ['Kalan Bakiye (KDV Dahil)', formatCurrencyWithType(remainingBalance, entry.currency)],
  );

  autoTable(doc, {
    startY: y,
    body: financialRows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 }, 1: { halign: 'right' } },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  addSignatureBlock(doc, y);
  
  doc.save(`sozlesme-raporu-${entry.contractNo}.pdf`);
};

export const generateHakedisPDF = async (
  hakedis: SubcontractorHakedis,
  project: Project | undefined,
  contract: WorkEntry | undefined,
  subcontractorHakedisler: SubcontractorHakedis[]
) => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF('p', 'mm', 'a4');
  
  let y = addHeader(doc, 'ALTYÜKLENICI HAKEDİŞ RAPORU');

  // Hakedis Info
  y = addSectionTitle(doc, 'Hakediş Bilgileri', y, COLORS.primary);
  
  const infoRows: any[][] = [
    ['Hakediş No', hakedis.hakedisNo, 'Sözleşme No', hakedis.contractNo || '-'],
    ['Altyüklenici', hakedis.subcontractor, 'Proje', `${project?.projectCode || '-'} - ${project?.projectName || '-'}`],
    ['Sözleşme Tipi', contractTypeLabels[hakedis.contractType], 'Tarih', formatDate(hakedis.date)],
    ['Hakediş Tipi', hakedisTypeLabels[hakedis.hakedisType], 'Onay Durumu', approvalStatusLabels[hakedis.approvalStatus]],
  ];
  if (hakedis.description) {
    infoRows.push(['Açıklama', { content: hakedis.description, colSpan: 3 }]);
  }

  autoTable(doc, {
    startY: y,
    body: infoRows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 }, 2: { fontStyle: 'bold', cellWidth: 30 } },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Hakedis items
  if (hakedis.contractType === 'birim_fiyat' && hakedis.hakedisItems?.length) {
    y = addSectionTitle(doc, 'Hakediş Kalemleri', y, COLORS.indigo);
    autoTable(doc, {
      startY: y,
      head: [['#', 'Açıklama', 'Birim', 'Miktar', 'B.Fiyat', 'Tutar']],
      body: hakedis.hakedisItems.map((item, idx) => [
        idx + 1,
        item.description || item.workCategory,
        item.unit,
        item.quantity,
        formatCurrencyWithType(item.unitPrice, hakedis.currency),
        formatCurrencyWithType(item.amount, hakedis.currency),
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: COLORS.indigo, textColor: COLORS.white },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 15, halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Extra items
  if (hakedis.extraItems?.length) {
    y = addSectionTitle(doc, 'Sözleşme Harici Ek İşler', y, COLORS.amber);
    autoTable(doc, {
      startY: y,
      head: [['#', 'Açıklama', 'Birim', 'Miktar', 'B.Fiyat', 'Tutar']],
      body: hakedis.extraItems.map((item, idx) => [
        idx + 1,
        item.description,
        item.unit,
        item.quantity,
        formatCurrencyWithType(item.unitPrice, hakedis.currency),
        formatCurrencyWithType(item.amount, hakedis.currency),
      ]),
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: COLORS.amber, textColor: COLORS.white },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 15, halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Financial summary
  const subtotal = hakedis.totalAmount;
  const vatAmount = hakedis.vatRate ? subtotal * (hakedis.vatRate / 100) : 0;
  const totalWithVat = subtotal + vatAmount;
  const hakedisPaidAmount = hakedis.paidAmount || 0;
  const hakedisRemainingBalance = totalWithVat - hakedisPaidAmount;

  y = addSectionTitle(doc, 'Tutar Bilgileri', y, COLORS.green);
  
  const finRows: any[][] = [
    ['Hakediş Tutarı (KDV Hariç)', formatCurrencyWithType(subtotal, hakedis.currency)],
  ];
  if (hakedis.vatRate) {
    finRows.push([`KDV (%${hakedis.vatRate})`, formatCurrencyWithType(vatAmount, hakedis.currency)]);
  }
  finRows.push(
    ['Hakediş Tutarı (KDV Dahil)', formatCurrencyWithType(totalWithVat, hakedis.currency)],
    ['Ödenen Tutar (KDV Dahil)', formatCurrencyWithType(hakedisPaidAmount, hakedis.currency)],
    ['Kalan Bakiye (KDV Dahil)', formatCurrencyWithType(hakedisRemainingBalance, hakedis.currency)],
    ['Ödeme Durumu', hakedis.paymentStatus === 'odendi' ? '✓ Ödendi' : hakedis.paymentStatus === 'kismen_odendi' ? '◑ Kısmen Ödendi' : '○ Ödenmedi'],
  );
  if (hakedis.paidDate) {
    finRows.push(['Ödeme Tarihi', formatDate(hakedis.paidDate)]);
  }

  autoTable(doc, {
    startY: y,
    body: finRows,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 }, 1: { halign: 'right' } },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Contract exceeded warning
  if (hakedis.contractExceededNote) {
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(...COLORS.red);
    doc.roundedRect(14, y, doc.internal.pageSize.getWidth() - 28, 10, 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.red);
    doc.text(`⚠ UYARI: ${hakedis.contractExceededNote}`, 18, y + 6);
    y += 14;
  }

  // Contract summary
  if (contract) {
    const contractSubtotal = contract.totalAmount;
    const contractVat = contract.vatRate ? contractSubtotal * (contract.vatRate / 100) : 0;
    const contractTotal = contractSubtotal + contractVat;
    const approvedContractHakedisler = subcontractorHakedisler.filter(h => h.contractId === hakedis.contractId && h.approvalStatus === 'onaylandi');
    const totalHakedisAmount = approvedContractHakedisler.reduce((sum, h) => {
      const hVat = h.vatRate ? h.totalAmount * (h.vatRate / 100) : 0;
      return sum + h.totalAmount + hVat;
    }, 0);
    const totalPaidOnContract = approvedContractHakedisler.reduce((sum, h) => sum + (h.paidAmount || 0), 0);

    y = addSectionTitle(doc, 'Sözleşme Özeti', y, COLORS.amber);
    autoTable(doc, {
      startY: y,
      body: [
        ['Sözleşme Tutarı (KDV Dahil)', formatCurrencyWithType(contractTotal, contract.currency)],
        ['Toplam Hakediş Tutarı (KDV Dahil)', formatCurrencyWithType(totalHakedisAmount, contract.currency)],
        ['Ödenen Tutar (KDV Dahil)', formatCurrencyWithType(totalPaidOnContract, contract.currency)],
        ['Kalan Bakiye (KDV Dahil)', formatCurrencyWithType(contractTotal - totalPaidOnContract, contract.currency)],
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 }, 1: { halign: 'right' } },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  addSignatureBlock(doc, y);
  
  doc.save(`hakedis-raporu-${hakedis.hakedisNo}.pdf`);
};
