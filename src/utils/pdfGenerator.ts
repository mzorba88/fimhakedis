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
import { 
  loadPdfLibs, 
  setupPdfFont, 
  addCompanyHeader, 
  addSectionTitle, 
  addSignatureBlock, 
  COLORS 
} from './pdfSetup';

export const generateContractPDF = async (
  entry: WorkEntry, 
  project: Project | undefined,
  subcontractorHakedisler: SubcontractorHakedis[]
) => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF('p', 'mm', 'a4');
  await setupPdfFont(doc);
  
  let y = await addCompanyHeader(doc, 'ALTYUKLENICI SOZLESME RAPORU');

  // Contract Info
  y = addSectionTitle(doc, 'Sozlesme Bilgileri', y, COLORS.primary);
  
  autoTable(doc, {
    startY: y,
    body: [
      ['Sozlesme No', entry.contractNo, 'Proje', `${project?.projectCode || '-'} - ${project?.projectName || '-'}`],
      ['Altyuklenici', entry.subcontractor, 'Is Kalemi', entry.workCategory],
      ['Sozlesme Tipi', contractTypeLabels[entry.contractType], 'Tarih', formatDate(entry.date)],
      ['Onay Durumu', approvalStatusLabels[entry.approvalStatus], 'Odeme Durumu', paymentStatusLabels[entry.paymentStatus]],
      ...(entry.description ? [['Aciklama', { content: entry.description, colSpan: 3 }]] : []),
    ],
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 }, 2: { fontStyle: 'bold', cellWidth: 30 } },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Work items for birim fiyat
  if (entry.contractType === 'birim_fiyat' && entry.workItemEntries?.length) {
    y = addSectionTitle(doc, 'Is Kalemleri', y, COLORS.indigo);
    autoTable(doc, {
      startY: y,
      head: [['#', 'Aciklama', 'Birim', 'Miktar', 'Birim Fiyat', 'Toplam']],
      body: entry.workItemEntries.map((item, idx) => [
        idx + 1,
        item.description || item.workCategory,
        item.unit,
        item.quantity,
        formatCurrencyWithType(item.unitPrice, entry.currency),
        formatCurrencyWithType(item.quantity * item.unitPrice, entry.currency),
      ]),
      theme: 'grid',
      styles: { font: 'Roboto', fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: COLORS.indigo, textColor: COLORS.white },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 15, halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Payment plan for goturu bedel
  if (entry.contractType === 'goturu_bedel' && entry.paymentPlan?.length) {
    y = addSectionTitle(doc, 'Odeme Plani', y, COLORS.indigo);
    autoTable(doc, {
      startY: y,
      head: [['#', 'Aciklama', 'Tutar', 'Durum']],
      body: entry.paymentPlan.map((p, idx) => [
        idx + 1,
        p.description || '-',
        formatCurrencyWithType(p.amount, entry.currency),
        p.isPaid ? 'Odendi' : 'Odenmedi',
      ]),
      theme: 'grid',
      styles: { font: 'Roboto', fontSize: 8, cellPadding: 2 },
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
    ['Sozlesme Tutari (KDV Haric)', formatCurrencyWithType(subtotal, entry.currency)],
  ];
  if (entry.vatRate) {
    financialRows.push([`KDV (%${entry.vatRate})`, formatCurrencyWithType(vatAmount, entry.currency)]);
  }
  financialRows.push(
    ['Sozlesme Tutari (KDV Dahil)', formatCurrencyWithType(totalWithVat, entry.currency)],
    ['Toplam Hakedis Tutari (KDV Dahil)', formatCurrencyWithType(totalHakedisAmount, entry.currency)],
    ['Odenen Tutar (KDV Dahil)', formatCurrencyWithType(paidAmount, entry.currency)],
    ['Kalan Bakiye (KDV Dahil)', formatCurrencyWithType(remainingBalance, entry.currency)],
  );

  autoTable(doc, {
    startY: y,
    body: financialRows,
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
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
  await setupPdfFont(doc);
  
  let y = await addCompanyHeader(doc, 'ALTYUKLENICI HAKEDIS RAPORU');

  // Hakedis Info
  y = addSectionTitle(doc, 'Hakedis Bilgileri', y, COLORS.primary);
  
  const infoRows: any[][] = [
    ['Hakedis No', hakedis.hakedisNo, 'Sozlesme No', hakedis.contractNo || '-'],
    ['Altyuklenici', hakedis.subcontractor, 'Proje', `${project?.projectCode || '-'} - ${project?.projectName || '-'}`],
    ['Sozlesme Tipi', contractTypeLabels[hakedis.contractType], 'Tarih', formatDate(hakedis.date)],
    ['Hakedis Tipi', hakedisTypeLabels[hakedis.hakedisType], 'Onay Durumu', approvalStatusLabels[hakedis.approvalStatus]],
  ];
  if (hakedis.description) {
    infoRows.push(['Aciklama', { content: hakedis.description, colSpan: 3 }]);
  }

  autoTable(doc, {
    startY: y,
    body: infoRows,
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 }, 2: { fontStyle: 'bold', cellWidth: 30 } },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Hakedis items
  if (hakedis.contractType === 'birim_fiyat' && hakedis.hakedisItems?.length) {
    y = addSectionTitle(doc, 'Hakedis Kalemleri', y, COLORS.indigo);
    autoTable(doc, {
      startY: y,
      head: [['#', 'Aciklama', 'Birim', 'Miktar', 'B.Fiyat', 'Tutar']],
      body: hakedis.hakedisItems.map((item, idx) => [
        idx + 1,
        item.description || item.workCategory,
        item.unit,
        item.quantity,
        formatCurrencyWithType(item.unitPrice, hakedis.currency),
        formatCurrencyWithType(item.amount, hakedis.currency),
      ]),
      theme: 'grid',
      styles: { font: 'Roboto', fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: COLORS.indigo, textColor: COLORS.white },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 2: { cellWidth: 15, halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Extra items
  if (hakedis.extraItems?.length) {
    y = addSectionTitle(doc, 'Sozlesme Harici Ek Isler', y, COLORS.amber);
    autoTable(doc, {
      startY: y,
      head: [['#', 'Aciklama', 'Birim', 'Miktar', 'B.Fiyat', 'Tutar']],
      body: hakedis.extraItems.map((item, idx) => [
        idx + 1,
        item.description,
        item.unit,
        item.quantity,
        formatCurrencyWithType(item.unitPrice, hakedis.currency),
        formatCurrencyWithType(item.amount, hakedis.currency),
      ]),
      theme: 'grid',
      styles: { font: 'Roboto', fontSize: 8, cellPadding: 2 },
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
    ['Hakedis Tutari (KDV Haric)', formatCurrencyWithType(subtotal, hakedis.currency)],
  ];
  if (hakedis.vatRate) {
    finRows.push([`KDV (%${hakedis.vatRate})`, formatCurrencyWithType(vatAmount, hakedis.currency)]);
  }
  finRows.push(
    ['Hakedis Tutari (KDV Dahil)', formatCurrencyWithType(totalWithVat, hakedis.currency)],
    ['Odenen Tutar (KDV Dahil)', formatCurrencyWithType(hakedisPaidAmount, hakedis.currency)],
    ['Kalan Bakiye (KDV Dahil)', formatCurrencyWithType(hakedisRemainingBalance, hakedis.currency)],
    ['Odeme Durumu', hakedis.paymentStatus === 'odendi' ? 'Odendi' : hakedis.paymentStatus === 'kismen_odendi' ? 'Kismen Odendi' : 'Odenmedi'],
  );
  if (hakedis.paidDate) {
    finRows.push(['Odeme Tarihi', formatDate(hakedis.paidDate)]);
  }

  autoTable(doc, {
    startY: y,
    body: finRows,
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
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
    doc.text(`UYARI: ${hakedis.contractExceededNote}`, 18, y + 6);
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

    y = addSectionTitle(doc, 'Sozlesme Ozeti', y, COLORS.amber);
    autoTable(doc, {
      startY: y,
      body: [
        ['Sozlesme Tutari (KDV Dahil)', formatCurrencyWithType(contractTotal, contract.currency)],
        ['Toplam Hakedis Tutari (KDV Dahil)', formatCurrencyWithType(totalHakedisAmount, contract.currency)],
        ['Odenen Tutar (KDV Dahil)', formatCurrencyWithType(totalPaidOnContract, contract.currency)],
        ['Kalan Bakiye (KDV Dahil)', formatCurrencyWithType(contractTotal - totalPaidOnContract, contract.currency)],
      ],
      theme: 'grid',
      styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
      columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 }, 1: { halign: 'right' } },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  addSignatureBlock(doc, y);
  
  doc.save(`hakedis-raporu-${hakedis.hakedisNo}.pdf`);
};
