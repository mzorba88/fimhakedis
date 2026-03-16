import { useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { useHakedisStore } from '@/store/hakedisStore';
import { formatCurrency, formatCurrencyWithType, formatDate, contractTypeLabels } from '@/types/hakedis';
import { 
  FileText, 
  Download, 
  Plus,
  FileSpreadsheet,
  Building2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { loadPdfLibs, setupPdfFont, addCompanyHeader, addSectionTitle, addSignatureBlock, COLORS } from '@/utils/pdfSetup';

export default function Reports() {
  const { projects, workEntries, subcontractorHakedisler } = useHakedisStore();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  
  const getProjectEntries = (projectId: string) => {
    return workEntries.filter(
      e => e.projectId === projectId && e.approvalStatus === 'onaylandi'
    );
  };

  const getProjectHakedisler = (projectId: string) => {
    return subcontractorHakedisler.filter(
      h => h.projectId === projectId && h.approvalStatus === 'onaylandi'
    );
  };

  const generateReportData = () => {
    if (!selectedProject) return null;

    const entries = getProjectEntries(selectedProjectId).filter(e => {
      const entryDate = new Date(e.date);
      const start = periodStart ? new Date(periodStart) : new Date(0);
      const end = periodEnd ? new Date(periodEnd) : new Date();
      return entryDate >= start && entryDate <= end;
    });

    // Calculate previous period total (before periodStart)
    const previousEntries = getProjectEntries(selectedProjectId).filter(e => {
      const entryDate = new Date(e.date);
      const start = periodStart ? new Date(periodStart) : new Date(0);
      return entryDate < start;
    });

    const previousTotal = previousEntries.reduce((sum, e) => sum + e.totalAmount, 0);
    const currentPeriodTotal = entries.reduce((sum, e) => sum + e.totalAmount, 0);
    const cumulativeTotal = previousTotal + currentPeriodTotal;

    // Financial summary
    const allContracts = workEntries.filter(e => e.projectId === selectedProjectId);
    const contractTotal = allContracts.reduce((sum, e) => sum + e.totalAmount, 0);
    const allHakedisler = getProjectHakedisler(selectedProjectId);
    const hakedisTotal = allHakedisler.reduce((sum, h) => sum + h.totalAmount, 0);
    const paidTotal = allHakedisler.reduce((sum, h) => sum + (h.paidAmount || 0), 0);
    const remainingBalance = hakedisTotal - paidTotal;

    return {
      project: selectedProject,
      entries,
      previousTotal,
      currentPeriodTotal,
      cumulativeTotal,
      grandTotal: cumulativeTotal,
      contractTotal,
      hakedisTotal,
      paidTotal,
      remainingBalance,
      periodStart,
      periodEnd,
    };
  };

  const handleExportPDF = async () => {
    const data = generateReportData();
    if (!data) {
      toast.error('Lütfen bir proje seçin');
      return;
    }

    try {
      const { jsPDF, autoTable } = await loadPdfLibs();
      
      const doc = new jsPDF('p', 'mm', 'a4');
      await setupPdfFont(doc);
      const pageWidth = doc.internal.pageSize.getWidth();
      
      let y = await addCompanyHeader(doc, 'HAKEDIS RAPORU');
      
      // Project Info
      y = addSectionTitle(doc, 'Proje Bilgileri', y, COLORS.primary);
      
      autoTable(doc, {
        startY: y,
        body: [
          ['Proje Adi', data.project.projectName, 'Proje Kodu', data.project.projectCode],
          ['Lokasyon', data.project.location, 'Donem', `${data.periodStart ? formatDate(data.periodStart) : 'Baslangic'} - ${data.periodEnd ? formatDate(data.periodEnd) : 'Bugun'}`],
        ],
        theme: 'grid',
        styles: { font: 'Roboto', fontSize: 8, cellPadding: 2.5 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 }, 2: { fontStyle: 'bold', cellWidth: 30 } },
        alternateRowStyles: { fillColor: COLORS.lightGray },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
      
      // Entries table
      if (data.entries.length > 0) {
        y = addSectionTitle(doc, 'Hakedis Kalemleri', y, COLORS.indigo);
        
        autoTable(doc, {
          startY: y,
          head: [['#', 'Is Kalemi', 'Altyuklenici', 'Soz. Tipi', 'Tutar']],
          body: data.entries.map((entry, idx) => [
            idx + 1,
            entry.workCategory,
            entry.subcontractor,
            contractTypeLabels[entry.contractType],
            formatCurrencyWithType(entry.totalAmount, entry.currency),
          ]),
          theme: 'grid',
          styles: { font: 'Roboto', fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: COLORS.indigo, textColor: COLORS.white },
          alternateRowStyles: { fillColor: COLORS.lightGray },
          columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 4: { halign: 'right' } },
          margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 6;
      }
      
      // Financial Summary
      y = addSectionTitle(doc, 'Finansal Ozet', y, COLORS.green);
      
      autoTable(doc, {
        startY: y,
        body: [
          ['Toplam Sözleşme Tutarı', formatCurrency(data.contractTotal)],
          ['Toplam Hakediş Tutarı', formatCurrency(data.hakedisTotal)],
          ['Ödenen Tutar', formatCurrency(data.paidTotal)],
          ['Kalan Bakiye', formatCurrency(data.remainingBalance)],
        ],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 }, 1: { halign: 'right' } },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
      
      // Period Summary
      doc.setFontSize(11);
      doc.text('Dönem Özeti', 14, y);
      doc.setDrawColor(99, 102, 241);
      doc.line(14, y + 1.5, 80, y + 1.5);
      y += 6;
      
      autoTable(doc, {
        startY: y,
        body: [
          ['Önceki Toplam', formatCurrency(data.previousTotal)],
          ['Bu Dönem', formatCurrency(data.currentPeriodTotal)],
          ['Kümülatif Toplam', formatCurrency(data.cumulativeTotal)],
        ],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 }, 1: { halign: 'right' } },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
      
      // Signature block
      const colWidth = (pageWidth - 28) / 2;
      y += 10;
      doc.setFontSize(9);
      doc.setTextColor(26, 26, 26);
      doc.text('Direktör Onayı:', 14 + colWidth / 2, y, { align: 'center' });
      doc.text('Muhasebe Onayı:', 14 + colWidth + colWidth / 2, y, { align: 'center' });
      y += 18;
      doc.setDrawColor(26, 26, 26);
      doc.line(24, y, 24 + colWidth - 20, y);
      doc.line(14 + colWidth + 10, y, 14 + colWidth + colWidth - 10, y);
      y += 4;
      doc.setFontSize(7);
      doc.setTextColor(107, 114, 128);
      doc.text('İmza / Tarih', 14 + colWidth / 2, y, { align: 'center' });
      doc.text('İmza / Tarih', 14 + colWidth + colWidth / 2, y, { align: 'center' });
      
      const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
      doc.save(`hakedis-raporu-${data.project.projectCode}-${dateStr}.pdf`);
      toast.success('PDF raporu indirildi');
      setIsDialogOpen(false);
    } catch (error) {
      console.error('PDF oluşturma hatası:', error);
      toast.error('PDF oluşturulamadı');
    }
  };

  const handleExportExcel = async () => {
    const data = generateReportData();
    if (!data) {
      toast.error('Lütfen bir proje seçin');
      return;
    }

    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    
    // Header info with branding
    const headerData = [
      ['HAKEDİŞ RAPORU'],
      [],
      ['Proje Adı', data.project.projectName],
      ['Proje Kodu', data.project.projectCode],
      ['Lokasyon', data.project.location],
      ['Dönem', `${data.periodStart ? formatDate(data.periodStart) : 'Başlangıç'} - ${data.periodEnd ? formatDate(data.periodEnd) : 'Bugün'}`],
      ['Rapor Tarihi', formatDate(new Date().toISOString())],
      [],
    ];

    // Table data
    const tableHeader = ['#', 'İş Kalemi', 'Altyüklenici', 'Sözleşme Tipi', 'Tutar'];
    const tableData = data.entries.map((entry, idx) => [
      idx + 1,
      entry.workCategory,
      entry.subcontractor,
      contractTypeLabels[entry.contractType],
      entry.totalAmount,
    ]);

    // Financial summary
    const financialData = [
      [],
      ['FİNANSAL ÖZET'],
      ['Toplam Sözleşme Tutarı', data.contractTotal],
      ['Toplam Hakediş Tutarı', data.hakedisTotal],
      ['Ödenen Tutar', data.paidTotal],
      ['Kalan Bakiye', data.remainingBalance],
    ];

    // Period summary
    const summaryData = [
      [],
      ['DÖNEM ÖZETİ'],
      ['Önceki Toplam', data.previousTotal],
      ['Bu Dönem', data.currentPeriodTotal],
      ['Kümülatif Toplam', data.cumulativeTotal],
      [],
      [],
      ['Direktör Onayı:', ''],
      ['İmza / Tarih:', '____________________'],
      [],
      ['Muhasebe Onayı:', ''],
      ['İmza / Tarih:', '____________________'],
    ];

    const allData = [
      ...headerData,
      tableHeader,
      ...tableData,
      ...financialData,
      ...summaryData,
    ];

    const ws = XLSX.utils.aoa_to_sheet(allData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 5 },   // #
      { wch: 25 },  // İş Kalemi
      { wch: 25 },  // Altyüklenici
      { wch: 20 },  // Sözleşme Tipi
      { wch: 20 },  // Tutar
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Hakediş Raporu');
    
    const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    XLSX.writeFile(wb, `hakedis-raporu-${data.project.projectCode}-${dateStr}.xlsx`);
    toast.success('Excel raporu indirildi');
    setIsDialogOpen(false);
  };

  // Calculate summary for each project
  const projectSummaries = projects.map(project => {
    const contracts = workEntries.filter(e => e.projectId === project.id);
    const contractTotal = contracts.reduce((sum, e) => sum + e.totalAmount, 0);
    const hakedisler = getProjectHakedisler(project.id);
    const hakedisTotal = hakedisler.reduce((sum, h) => sum + h.totalAmount, 0);
    const paidTotal = hakedisler.reduce((sum, h) => sum + (h.paidAmount || 0), 0);
    const remainingBalance = hakedisTotal - paidTotal;
    
    return {
      project,
      contractTotal,
      hakedisTotal,
      paidTotal,
      remainingBalance,
      entriesCount: contracts.length,
    };
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Hakediş Raporları</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Profesyonel hakediş raporları oluşturun ve indirin
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Yeni Rapor
          </Button>
        </div>

        {/* Project Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projectSummaries.map((summary, index) => (
            <motion.div
              key={summary.project.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="card-elevated p-5"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-accent p-2.5">
                  <Building2 className="h-5 w-5 text-accent-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-foreground truncate">
                    {summary.project.projectName}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {summary.project.projectCode}
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sözleşme Tutarı</span>
                  <span className="font-medium">{formatCurrency(summary.contractTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Hakediş Tutarı</span>
                  <span className="font-medium">{formatCurrency(summary.hakedisTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ödenen</span>
                  <span className="font-medium text-status-paid">{formatCurrency(summary.paidTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kalan Bakiye</span>
                  <span className="font-medium text-status-pending">{formatCurrency(summary.remainingBalance)}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 gap-1.5"
                  onClick={() => {
                    setSelectedProjectId(summary.project.id);
                    setIsDialogOpen(true);
                  }}
                >
                  <FileText className="h-4 w-4" />
                  PDF
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1 gap-1.5"
                  onClick={() => {
                    setSelectedProjectId(summary.project.id);
                    setIsDialogOpen(true);
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        {projects.length === 0 && (
          <div className="card-elevated p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium text-foreground">Proje bulunamadı</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Rapor oluşturmak için önce proje eklemeniz gerekiyor.
            </p>
          </div>
        )}
      </div>

      {/* Report Generation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hakediş Raporu Oluştur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Proje *</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Proje seçin" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.projectCode} - {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dönem Başlangıç</Label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Dönem Bitiş</Label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>

            {selectedProject && (
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-medium text-foreground mb-2">Rapor Özeti</p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Proje: {selectedProject.projectCode}</p>
                  <p>Lokasyon: {selectedProject.location}</p>
                  <p>Onaylı Kayıt: {getProjectEntries(selectedProjectId).length} adet</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">
              İptal
            </Button>
            <Button 
              variant="outline" 
              onClick={handleExportExcel} 
              className="w-full sm:w-auto gap-2"
              disabled={!selectedProjectId}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel İndir
            </Button>
            <Button 
              onClick={handleExportPDF} 
              className="w-full sm:w-auto gap-2"
              disabled={!selectedProjectId}
            >
              <Download className="h-4 w-4" />
              PDF İndir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
