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
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import formanLogo from '@/assets/forman-logo.png';

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

  const handleExportPDF = async () => {
    const data = generateReportData();
    if (!data) {
      toast.error('Lütfen bir proje seçin');
      return;
    }

    // Create a temporary container for the PDF content - optimized for single page
    const container = document.createElement('div');
    container.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 800px; padding: 20px; background: white; font-family: Arial, sans-serif;';
    
    // Generate table rows - compact format
    const tableRows = data.entries.map((entry, idx) => `
      <tr style="background: ${idx % 2 === 0 ? '#f9fafb' : 'white'};">
        <td style="padding: 4px 6px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd;">${entry.workCategory}</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd;">${entry.subcontractor}</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd;">${contractTypeLabels[entry.contractType]}</td>
        <td style="padding: 4px 6px; border: 1px solid #ddd; text-align: right;">${formatCurrencyWithType(entry.totalAmount, entry.currency)}</td>
      </tr>
    `).join('');

    container.innerHTML = `
      <div style="margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between;">
        <img src="${formanLogo}" style="height: 35px;" />
        <div style="text-align: right;">
          <h1 style="font-size: 18px; margin: 0; color: #1a1a1a;">HAKEDİŞ RAPORU</h1>
          <p style="font-size: 10px; color: #666; margin: 2px 0 0 0;">Rapor Tarihi: ${formatDate(new Date().toISOString())}</p>
        </div>
      </div>
      
      <div style="margin-bottom: 12px;">
        <h2 style="font-size: 12px; margin-bottom: 6px; color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 3px;">Proje Bilgileri</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <tbody>
            <tr style="background: #f9fafb;">
              <td style="padding: 5px 8px; border: 1px solid #ddd; width: 20%;">Proje Adı</td>
              <td style="padding: 5px 8px; border: 1px solid #ddd; font-weight: bold; width: 30%;">${data.project.projectName}</td>
              <td style="padding: 5px 8px; border: 1px solid #ddd; width: 20%;">Proje Kodu</td>
              <td style="padding: 5px 8px; border: 1px solid #ddd; width: 30%;">${data.project.projectCode}</td>
            </tr>
            <tr>
              <td style="padding: 5px 8px; border: 1px solid #ddd;">Lokasyon</td>
              <td style="padding: 5px 8px; border: 1px solid #ddd;">${data.project.location}</td>
              <td style="padding: 5px 8px; border: 1px solid #ddd;">Dönem</td>
              <td style="padding: 5px 8px; border: 1px solid #ddd;">${data.periodStart ? formatDate(data.periodStart) : 'Başlangıç'} - ${data.periodEnd ? formatDate(data.periodEnd) : 'Bugün'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      ${data.entries.length > 0 ? `
      <div style="margin-bottom: 12px;">
        <h2 style="font-size: 12px; margin-bottom: 6px; color: #1a1a1a; border-bottom: 2px solid #6366f1; padding-bottom: 3px;">Hakediş Kalemleri</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
          <thead>
            <tr style="background: #6366f1; color: white;">
              <th style="padding: 4px 6px; text-align: center; border: 1px solid #ddd; width: 30px;">#</th>
              <th style="padding: 4px 6px; text-align: left; border: 1px solid #ddd;">İş Kalemi</th>
              <th style="padding: 4px 6px; text-align: left; border: 1px solid #ddd;">Altyüklenici</th>
              <th style="padding: 4px 6px; text-align: left; border: 1px solid #ddd;">Söz. Tipi</th>
              <th style="padding: 4px 6px; text-align: right; border: 1px solid #ddd;">Tutar</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      <div style="margin-bottom: 12px;">
        <h2 style="font-size: 12px; margin-bottom: 6px; color: #1a1a1a; border-bottom: 2px solid #22c55e; padding-bottom: 3px;">Özet Bilgiler</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 10px;">
          <tbody>
            <tr style="background: #f9fafb;">
              <td style="padding: 5px 8px; border: 1px solid #ddd; width: 50%;">Önceki Toplam</td>
              <td style="padding: 5px 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(data.previousTotal)}</td>
            </tr>
            <tr>
              <td style="padding: 5px 8px; border: 1px solid #ddd;">Bu Dönem</td>
              <td style="padding: 5px 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(data.currentPeriodTotal)}</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 5px 8px; border: 1px solid #ddd;">Kümülatif Toplam</td>
              <td style="padding: 5px 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(data.cumulativeTotal)}</td>
            </tr>
            <tr style="background: #3b82f6; color: white;">
              <td style="padding: 5px 8px; border: 1px solid #ddd; font-weight: bold;">GENEL TOPLAM</td>
              <td style="padding: 5px 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(data.grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-top: 20px;">
        <div style="text-align: center; width: 45%;">
          <p style="font-size: 10px; margin-bottom: 20px;">Direktör Onayı:</p>
          <div style="border-bottom: 1px solid #333; margin-bottom: 3px;"></div>
          <p style="font-size: 8px; color: #666;">İmza / Tarih</p>
        </div>
        <div style="text-align: center; width: 45%;">
          <p style="font-size: 10px; margin-bottom: 20px;">Muhasebe Onayı:</p>
          <div style="border-bottom: 1px solid #333; margin-bottom: 3px;"></div>
          <p style="font-size: 8px; color: #666;">İmza / Tarih</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(container);
    
  try {
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgData = canvas.toDataURL('image/png');
      
      // Calculate dimensions to fit on single page
      const pageWidth = 190;
      const pageHeight = 277; // Leave margin
      const imgRatio = canvas.width / canvas.height;
      const pageRatio = pageWidth / pageHeight;
      
      let imgWidth, imgHeight;
      if (imgRatio > pageRatio) {
        imgWidth = pageWidth;
        imgHeight = pageWidth / imgRatio;
      } else {
        imgHeight = pageHeight;
        imgWidth = pageHeight * imgRatio;
      }
      
      const xOffset = (210 - imgWidth) / 2;
      const yOffset = 10;
      
      pdf.addImage(imgData, 'PNG', xOffset, yOffset, imgWidth, imgHeight);
      
      const dateStr = new Date().toLocaleDateString('tr-TR').replace(/\\./g, '-');
      pdf.save(`hakedis-raporu-${data.project.projectCode}-${dateStr}.pdf`);
      toast.success('PDF raporu indirildi');
      setIsDialogOpen(false);
    } catch (error) {
      console.error('PDF oluşturma hatası:', error);
      toast.error('PDF oluşturulamadı');
    } finally {
      document.body.removeChild(container);
    }
  };

  const handleExportExcel = () => {
    const data = generateReportData();
    if (!data) {
      toast.error('Lütfen bir proje seçin');
      return;
    }

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

    // Summary with proper Turkish labels
    const summaryData = [
      [],
      ['ÖZET BİLGİLER'],
      ['Önceki Toplam', data.previousTotal],
      ['Bu Dönem', data.currentPeriodTotal],
      ['Kümülatif Toplam', data.cumulativeTotal],
      ['GENEL TOPLAM', data.grandTotal],
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
