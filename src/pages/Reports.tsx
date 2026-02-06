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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function Reports() {
  const { projects, workEntries } = useHakedisStore();
  
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

    return {
      project: selectedProject,
      entries,
      previousTotal,
      currentPeriodTotal,
      cumulativeTotal,
      grandTotal: cumulativeTotal,
      periodStart,
      periodEnd,
    };
  };

  const handleExportPDF = () => {
    const data = generateReportData();
    if (!data) {
      toast.error('Lütfen bir proje seçin');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('ALTYUKLENICI HAKEDISI', pageWidth / 2, 25, { align: 'center' });

    // Project Info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    const infoY = 40;
    doc.text(`Proje Adi: ${data.project.projectName}`, 20, infoY);
    doc.text(`Proje Kodu: ${data.project.projectCode}`, 20, infoY + 6);
    doc.text(`Lokasyon: ${data.project.location}`, 20, infoY + 12);
    
    const dateStr = new Date().toLocaleDateString('tr-TR');
    doc.text(`Tarih: ${dateStr}`, pageWidth - 60, infoY);
    doc.text(`Donem: ${data.periodStart || 'Baslangic'} - ${data.periodEnd || 'Bugun'}`, pageWidth - 60, infoY + 6);

    // Table
    const tableData = data.entries.map(entry => [
      entry.workCategory,
      entry.subcontractor,
      contractTypeLabels[entry.contractType],
      formatCurrencyWithType(entry.totalAmount, entry.currency),
    ]);

    autoTable(doc, {
      startY: 65,
      head: [['Is Kalemi', 'Altyuklenici', 'Sozlesme Tipi', 'Tutar']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8 },
    });

    // Summary
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    autoTable(doc, {
      startY: finalY,
      body: [
        ['Onceki Toplam', formatCurrency(data.previousTotal)],
        ['Bu Donem', formatCurrency(data.currentPeriodTotal)],
        ['Kumulatif Toplam', formatCurrency(data.cumulativeTotal)],
        ['GENEL TOPLAM', formatCurrency(data.grandTotal)],
      ],
      theme: 'plain',
      styles: { fontSize: 10 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 80 },
        1: { halign: 'right', cellWidth: 60 },
      },
      margin: { left: pageWidth - 160 },
    });

    // Signature Area
    const signatureY = (doc as any).lastAutoTable.finalY + 30;
    doc.setFontSize(10);
    doc.text('Direktor Onayi:', 20, signatureY);
    doc.line(20, signatureY + 20, 80, signatureY + 20);
    doc.text('Imza', 45, signatureY + 25);
    doc.text('Tarih: _______________', 20, signatureY + 35);

    // Save
    doc.save(`hakedis_${data.project.projectCode}_${dateStr.replace(/\./g, '-')}.pdf`);
    toast.success('PDF raporu indirildi');
    setIsDialogOpen(false);
  };

  const handleExportExcel = () => {
    const data = generateReportData();
    if (!data) {
      toast.error('Lütfen bir proje seçin');
      return;
    }

    const wb = XLSX.utils.book_new();
    
    // Header info
    const headerData = [
      ['ALTYUKLENICI HAKEDISI'],
      [],
      ['Proje Adi', data.project.projectName],
      ['Proje Kodu', data.project.projectCode],
      ['Lokasyon', data.project.location],
      ['Donem', `${data.periodStart || 'Baslangic'} - ${data.periodEnd || 'Bugun'}`],
      [],
    ];

    // Table data
    const tableHeader = ['Is Kalemi', 'Altyuklenici', 'Sozlesme Tipi', 'Tutar'];
    const tableData = data.entries.map(entry => [
      entry.workCategory,
      entry.subcontractor,
      contractTypeLabels[entry.contractType],
      entry.totalAmount,
    ]);

    // Summary
    const summaryData = [
      [],
      ['Onceki Toplam', data.previousTotal],
      ['Bu Donem', data.currentPeriodTotal],
      ['Kumulatif Toplam', data.cumulativeTotal],
      ['GENEL TOPLAM', data.grandTotal],
    ];

    const allData = [
      ...headerData,
      tableHeader,
      ...tableData,
      ...summaryData,
    ];

    const ws = XLSX.utils.aoa_to_sheet(allData);
    XLSX.utils.book_append_sheet(wb, ws, 'Hakedis');
    
    const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    XLSX.writeFile(wb, `hakedis_${data.project.projectCode}_${dateStr}.xlsx`);
    toast.success('Excel raporu indirildi');
    setIsDialogOpen(false);
  };

  // Calculate summary for each project
  const projectSummaries = projects.map(project => {
    const entries = getProjectEntries(project.id);
    const approvedTotal = entries.reduce((sum, e) => sum + e.totalAmount, 0);
    const paidTotal = entries
      .filter(e => e.paymentStatus === 'odendi')
      .reduce((sum, e) => sum + e.totalAmount, 0);
    
    return {
      project,
      approvedTotal,
      paidTotal,
      unpaidTotal: approvedTotal - paidTotal,
      entriesCount: entries.length,
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
                  <span className="text-muted-foreground">Onaylanan Toplam</span>
                  <span className="font-medium">{formatCurrency(summary.approvedTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ödenen</span>
                  <span className="font-medium text-status-paid">{formatCurrency(summary.paidTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bekleyen</span>
                  <span className="font-medium text-status-pending">{formatCurrency(summary.unpaidTotal)}</span>
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
