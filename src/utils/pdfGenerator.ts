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
  subcontractorHakedisler: SubcontractorHakedis[],
  options?: { autoPrint?: boolean }
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
  const hakedisUnpaidPortion = totalWithVat - hakedisPaidAmount;

  y = addSectionTitle(doc, 'Tutar Bilgileri', y, COLORS.green);
  
  const finRows: any[][] = [
    ['Hakedis Tutari (KDV Haric)', formatCurrencyWithType(subtotal, hakedis.currency)],
  ];
  if (hakedis.vatRate) {
    finRows.push([`KDV (%${hakedis.vatRate})`, formatCurrencyWithType(vatAmount, hakedis.currency)]);
  }
  finRows.push(
    ['Hakedis Tutari (KDV Dahil)', formatCurrencyWithType(totalWithVat, hakedis.currency)],
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
    const thisHakedisUnpaid = totalWithVat - (hakedis.paidAmount || 0);
    const remainingAfterPayment = contractTotal - totalPaidOnContract - thisHakedisUnpaid;

    y = addSectionTitle(doc, 'Sozlesme Ozeti', y, COLORS.amber);
    autoTable(doc, {
      startY: y,
      body: [
        ['Sozlesme Tutari (KDV Dahil)', formatCurrencyWithType(contractTotal, contract.currency)],
        ['Toplam Hakedis Tutari (KDV Dahil)', formatCurrencyWithType(totalHakedisAmount, contract.currency)],
        ['Odeme Gerceklesince Kalan Bakiye (KDV Dahil)', formatCurrencyWithType(remainingAfterPayment, contract.currency)],
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

  if (options?.autoPrint) {
    (doc as any).autoPrint();
    const blobUrl = doc.output('bloburl');
    const printWindow = window.open(blobUrl as any, '_blank');
    if (!printWindow) {
      // popup blocked — fallback to download
      doc.save(`hakedis-raporu-${hakedis.hakedisNo}.pdf`);
    }
  } else {
    doc.save(`hakedis-raporu-${hakedis.hakedisNo}.pdf`);
  }
};

// ============= ALTYÜKLENİCİ BAZLI RAPOR =============
export interface SubcontractorReportFilters {
  projectName?: string;
  workCategory?: string;
  paymentStatus?: string;
  search?: string;
}

export const generateSubcontractorPDF = async (
  subcontractorName: string,
  contracts: WorkEntry[],
  hakedisler: SubcontractorHakedis[],
  projects: Project[],
  filters?: SubcontractorReportFilters
) => {
  const { jsPDF, autoTable } = await loadPdfLibs();
  const doc = new jsPDF('p', 'mm', 'a4');
  await setupPdfFont(doc);

  let y = await addCompanyHeader(doc, 'ALTYUKLENICI RAPORU');

  // Subcontractor info + filters
  y = addSectionTitle(doc, 'Altyuklenici Bilgileri', y, COLORS.primary);
  const infoRows: any[][] = [
    ['Altyuklenici', subcontractorName, 'Sozlesme Sayisi', String(contracts.length)],
    ['Hakedis Sayisi', String(hakedisler.length), 'Rapor Tarihi', formatDate(new Date().toISOString())],
  ];
  if (filters?.projectName && filters.projectName !== 'all') {
    infoRows.push(['Proje Filtresi', filters.projectName, '', '']);
  }
  if (filters?.workCategory && filters.workCategory !== 'all') {
    infoRows.push(['Is Kalemi Filtresi', filters.workCategory, '', '']);
  }
  if (filters?.paymentStatus && filters.paymentStatus !== 'all') {
    infoRows.push(['Odeme Durumu Filtresi', filters.paymentStatus, '', '']);
  }
  if (filters?.search) {
    infoRows.push(['Arama', filters.search, '', '']);
  }

  autoTable(doc, {
    startY: y,
    body: infoRows,
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 2.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 }, 2: { fontStyle: 'bold', cellWidth: 35 } },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  const projectNameOf = (id?: string) => {
    const p = projects.find(x => x.id === id);
    return p ? `${p.projectCode} - ${p.projectName}` : '-';
  };

  // Totals by currency
  const sumByCur = (arr: number[], curs: string[]) => {
    const map: Record<string, number> = {};
    arr.forEach((v, i) => { map[curs[i]] = (map[curs[i]] || 0) + v; });
    return map;
  };
  const contractTotals = sumByCur(
    contracts.map(c => {
      const vat = c.vatRate ? c.totalAmount * (c.vatRate / 100) : 0;
      return c.totalAmount + vat;
    }),
    contracts.map(c => c.currency)
  );
  const hakedisTotals = sumByCur(
    hakedisler.map(h => {
      const vat = h.vatRate ? h.totalAmount * (h.vatRate / 100) : 0;
      return h.totalAmount + vat;
    }),
    hakedisler.map(h => h.currency)
  );
  const paidTotals = sumByCur(
    hakedisler.map(h => h.paidAmount || 0),
    hakedisler.map(h => h.currency)
  );

  // Financial summary
  y = addSectionTitle(doc, 'Finansal Ozet (KDV Dahil)', y, COLORS.green);
  const currencies = Array.from(new Set([
    ...Object.keys(contractTotals),
    ...Object.keys(hakedisTotals),
    ...Object.keys(paidTotals),
  ]));
  const sumRows = currencies.length === 0
    ? [['Kayit yok', '-', '-', '-']]
    : currencies.map(cur => {
        const ct = contractTotals[cur] || 0;
        const ht = hakedisTotals[cur] || 0;
        const pt = paidTotals[cur] || 0;
        return [
          cur,
          formatCurrencyWithType(ct, cur as any),
          formatCurrencyWithType(ht, cur as any),
          formatCurrencyWithType(pt, cur as any),
          formatCurrencyWithType(ct - pt, cur as any),
        ];
      });
  autoTable(doc, {
    startY: y,
    head: [['Para Birimi', 'Sozlesme Toplami', 'Hakedis Toplami', 'Odenen', 'Kalan Bakiye']],
    body: sumRows,
    theme: 'grid',
    styles: { font: 'Roboto', fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: COLORS.green, textColor: COLORS.white },
    columnStyles: { 0: { halign: 'center', cellWidth: 22 }, 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Contracts table
  if (contracts.length > 0) {
    y = addSectionTitle(doc, `Sozlesmeler (${contracts.length})`, y, COLORS.indigo);
    autoTable(doc, {
      startY: y,
      head: [['#', 'Sozlesme No', 'Tarih', 'Proje', 'Is Kalemi', 'Tip', 'Tutar (KDV Dahil)', 'Onay', 'Odeme']],
      body: contracts.map((c, idx) => {
        const vat = c.vatRate ? c.totalAmount * (c.vatRate / 100) : 0;
        return [
          idx + 1,
          c.contractNo,
          formatDate(c.date),
          projectNameOf(c.projectId),
          c.workCategory,
          contractTypeLabels[c.contractType],
          formatCurrencyWithType(c.totalAmount + vat, c.currency),
          approvalStatusLabels[c.approvalStatus],
          paymentStatusLabels[c.paymentStatus],
        ];
      }),
      theme: 'grid',
      styles: { font: 'Roboto', fontSize: 7.5, cellPadding: 1.8 },
      headStyles: { fillColor: COLORS.indigo, textColor: COLORS.white },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 6: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // Hakedisler table
  if (hakedisler.length > 0) {
    if (y > 230) { doc.addPage(); y = 14; }
    y = addSectionTitle(doc, `Hakedisler (${hakedisler.length})`, y, COLORS.amber);
    autoTable(doc, {
      startY: y,
      head: [['#', 'Hakedis No', 'Tarih', 'Proje', 'Sozlesme No', 'Tip', 'Tutar (KDV Dahil)', 'Odenen', 'Onay', 'Odeme']],
      body: hakedisler.map((h, idx) => {
        const vat = h.vatRate ? h.totalAmount * (h.vatRate / 100) : 0;
        return [
          idx + 1,
          h.hakedisNo,
          formatDate(h.date),
          projectNameOf(h.projectId),
          h.contractNo || '-',
          hakedisTypeLabels[h.hakedisType],
          formatCurrencyWithType(h.totalAmount + vat, h.currency),
          formatCurrencyWithType(h.paidAmount || 0, h.currency),
          approvalStatusLabels[h.approvalStatus],
          paymentStatusLabels[h.paymentStatus],
        ];
      }),
      theme: 'grid',
      styles: { font: 'Roboto', fontSize: 7.5, cellPadding: 1.8 },
      headStyles: { fillColor: COLORS.amber, textColor: COLORS.white },
      alternateRowStyles: { fillColor: COLORS.lightGray },
      columnStyles: { 0: { cellWidth: 8, halign: 'center' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  addSignatureBlock(doc, y);

  const safeName = subcontractorName.replace(/[^\w\-]+/g, '_');
  doc.save(`altyuklenici-raporu-${safeName}.pdf`);
};

