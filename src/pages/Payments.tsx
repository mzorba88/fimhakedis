import { useState, useMemo } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { SortableTableHeader, useSorting } from '@/components/SortableTableHeader';
import { useHakedisStore } from '@/store/hakedisStore';
import { formatCurrencyWithType, formatDate, contractTypeLabels, formatCurrency } from '@/types/hakedis';
import { 
  Search, 
  Wallet,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Banknote,
  FileDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import formanLogo from '@/assets/forman-logo.png';

export default function Payments() {
  const { 
    projects, 
    workEntries,
    subcontractorHakedisler,
    markAsPaid,
    markHakedisAsPaid,
    currentUser,
    addActivityLog
  } = useHakedisStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const { sortConfig, handleSort } = useSorting({ key: 'approvalDate', direction: 'desc' });
  const [activeTab, setActiveTab] = useState('hakedisler');

  // Only show approved hakedisler
  const approvedHakedisler = subcontractorHakedisler.filter(h => h.approvalStatus === 'onaylandi');

  const filteredHakedisler = approvedHakedisler.filter(hakedis => {
    const project = projects.find(p => p.id === hakedis.projectId);
    const matchesSearch = 
      hakedis.subcontractor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hakedis.hakedisNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hakedis.contractNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project?.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project?.projectCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProject = filterProject === 'all' || hakedis.projectId === filterProject;
    const matchesPayment = filterPayment === 'all' || hakedis.paymentStatus === filterPayment;
    return matchesSearch && matchesProject && matchesPayment;
  });

  const sortedHakedisler = useMemo(() => {
    const sorted = [...filteredHakedisler];
    if (!sortConfig.key || !sortConfig.direction) {
      return sorted.sort((a, b) => new Date(b.approvalDate || b.createdAt).getTime() - new Date(a.approvalDate || a.createdAt).getTime());
    }
    
    return sorted.sort((a, b) => {
      const projectA = projects.find(p => p.id === a.projectId);
      const projectB = projects.find(p => p.id === b.projectId);
      
      let comparison = 0;
      switch (sortConfig.key) {
        case 'hakedisNo':
          comparison = a.hakedisNo.localeCompare(b.hakedisNo);
          break;
        case 'project':
          comparison = (projectA?.projectCode || '').localeCompare(projectB?.projectCode || '');
          break;
        case 'contractNo':
          comparison = a.contractNo.localeCompare(b.contractNo);
          break;
        case 'approvalDate':
          comparison = new Date(a.approvalDate || a.createdAt).getTime() - new Date(b.approvalDate || b.createdAt).getTime();
          break;
        case 'totalAmount':
          comparison = a.totalAmount - b.totalAmount;
          break;
        case 'paymentStatus':
          comparison = a.paymentStatus.localeCompare(b.paymentStatus);
          break;
        default:
          comparison = 0;
      }
      
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredHakedisler, sortConfig, projects]);

  // Summary Stats for hakedisler
  const totalApprovedHakedis = approvedHakedisler.reduce((sum, h) => sum + h.totalAmount, 0);
  const totalPaidHakedis = approvedHakedisler
    .filter(h => h.paymentStatus === 'odendi')
    .reduce((sum, h) => sum + h.totalAmount, 0);
  const totalUnpaidHakedis = totalApprovedHakedis - totalPaidHakedis;

  const handleMarkHakedisAsPaid = (hakedisId: string) => {
    const hakedis = subcontractorHakedisler.find(h => h.id === hakedisId);
    markHakedisAsPaid(hakedisId);
    if (hakedis) {
      addActivityLog(
        'hakedis_paid',
        `${hakedis.hakedisNo} hakediş ödendi olarak işaretlendi`,
        `Altyüklenici: ${hakedis.subcontractor} - Tutar: ${formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)}`,
        hakedisId,
        'hakedis'
      );
    }
    toast.success('Hakediş ödendi olarak işaretlendi');
  };

  const generatePaymentPdf = async (hakedis: typeof approvedHakedisler[0]) => {
    const project = projects.find(p => p.id === hakedis.projectId);
    
    // Create a temporary container for the PDF content
    const container = document.createElement('div');
    container.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 800px; padding: 40px; background: white; font-family: Arial, sans-serif;';
    
    container.innerHTML = `
      <div style="margin-bottom: 20px;">
        <img src="${formanLogo}" style="height: 50px; margin-bottom: 10px;" />
        <h1 style="text-align: center; font-size: 24px; margin: 10px 0; color: #1a1a1a;">ÖDEME RAPORU</h1>
        <p style="text-align: center; font-size: 12px; color: #666;">Rapor Tarihi: ${formatDate(new Date().toISOString())}</p>
      </div>
      
      <div style="margin-bottom: 25px;">
        <h2 style="font-size: 16px; margin-bottom: 10px; color: #1a1a1a; border-bottom: 2px solid #3b82f6; padding-bottom: 5px;">Hakediş Bilgileri</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #3b82f6; color: white;">
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Açıklama</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Değer</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #ddd;">Hakediş No</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${hakedis.hakedisNo}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Sözleşme No</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${hakedis.contractNo}</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #ddd;">Altyüklenici</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${hakedis.subcontractor}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Proje</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${project?.projectCode} - ${project?.projectName}</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #ddd;">Sözleşme Tipi</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${contractTypeLabels[hakedis.contractType]}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Tarih</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${formatDate(hakedis.date)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div style="margin-bottom: 25px;">
        <h2 style="font-size: 16px; margin-bottom: 10px; color: #1a1a1a; border-bottom: 2px solid #22c55e; padding-bottom: 5px;">Tutar Bilgileri</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #22c55e; color: white;">
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Açıklama</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Tutar</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #ddd;">Toplam Tutar</td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Ödeme Durumu</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${hakedis.paymentStatus === 'odendi' ? 'Ödendi' : 'Ödenmedi'}</td>
            </tr>
            ${hakedis.paidDate ? `
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #ddd;">Ödeme Tarihi</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${formatDate(hakedis.paidDate)}</td>
            </tr>
            ` : ''}
          </tbody>
        </table>
      </div>
      
      <div style="margin-bottom: 40px;">
        <h2 style="font-size: 16px; margin-bottom: 10px; color: #1a1a1a; border-bottom: 2px solid #6366f1; padding-bottom: 5px;">Onay Bilgileri</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #6366f1; color: white;">
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Açıklama</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Değer</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #ddd;">Onay Durumu</td>
              <td style="padding: 10px; border: 1px solid #ddd;">Onaylandı</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Onaylayan</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${hakedis.approvedBy || '-'}</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #ddd;">Onay Tarihi</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${hakedis.approvalDate ? formatDate(hakedis.approvalDate) : '-'}</td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div style="display: flex; justify-content: space-between; margin-top: 60px;">
        <div style="text-align: center; width: 45%;">
          <p style="font-size: 12px; margin-bottom: 40px;">Direktör Onayı:</p>
          <div style="border-bottom: 1px solid #333; margin-bottom: 5px;"></div>
          <p style="font-size: 10px; color: #666;">İmza / Tarih</p>
        </div>
        <div style="text-align: center; width: 45%;">
          <p style="font-size: 12px; margin-bottom: 40px;">Muhasebe Onayı:</p>
          <div style="border-bottom: 1px solid #333; margin-bottom: 5px;"></div>
          <p style="font-size: 10px; color: #666;">İmza / Tarih</p>
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
      
      const imgWidth = 190;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      let heightLeft = imgHeight;
      let position = 10;
      
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`odeme-raporu-${hakedis.hakedisNo}.pdf`);
      toast.success('PDF raporu oluşturuldu');
    } catch (error) {
      console.error('PDF oluşturma hatası:', error);
      toast.error('PDF oluşturulamadı');
    } finally {
      document.body.removeChild(container);
    }
  };

  const isAccountant = currentUser.role === 'muhasebe';

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Ödemeler</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Onaylanmış hakedişlerin ödeme takibi
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="stat-card"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-accent p-2.5">
                <CheckCircle2 className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Onaylanan Hakedişler</p>
                <p className="text-xl font-semibold">{formatCurrency(totalApprovedHakedis)}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="stat-card"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-status-paid-bg p-2.5">
                <Wallet className="h-5 w-5 text-status-paid" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ödenen Toplam</p>
                <p className="text-xl font-semibold text-status-paid">{formatCurrency(totalPaidHakedis)}</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="stat-card"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-status-pending-bg p-2.5">
                <Clock className="h-5 w-5 text-status-pending" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bekleyen Ödeme</p>
                <p className="text-xl font-semibold text-status-pending">{formatCurrency(totalUnpaidHakedis)}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Info Banner for non-accountants */}
        {!isAccountant && (
          <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-accent p-4">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <p className="text-sm text-foreground">
              Ödeme işlemleri sadece <strong>Muhasebe</strong> rolündeki kullanıcılar tarafından yapılabilir.
              Rol değiştirmek için sağ üstteki menüyü kullanabilirsiniz.
            </p>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Hakediş ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Proje Seç" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Projeler</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.projectCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPayment} onValueChange={setFilterPayment}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Ödeme Durumu" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              <SelectItem value="odendi">Ödendi</SelectItem>
              <SelectItem value="odenmedi">Ödenmedi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Hakedisler Table */}
        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <SortableTableHeader label="Hakediş No / Altyüklenici" sortKey="hakedisNo" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Proje" sortKey="project" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Sözleşme No" sortKey="contractNo" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Onay Tarihi" sortKey="approvalDate" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Tutar" sortKey="totalAmount" currentSort={sortConfig} onSort={handleSort} align="right" />
                  <SortableTableHeader label="Ödeme Durumu" sortKey="paymentStatus" currentSort={sortConfig} onSort={handleSort} align="center" />
                  {isAccountant && (
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      İşlem
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                <AnimatePresence>
                  {sortedHakedisler.map((hakedis) => {
                    const project = projects.find(p => p.id === hakedis.projectId);
                    const isPaid = hakedis.paymentStatus === 'odendi';
                    
                    return (
                      <motion.tr
                        key={hakedis.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="group hover:bg-muted/30"
                      >
                        <td className="px-4 py-4">
                          <div className="max-w-xs">
                            <p className="font-medium text-foreground">
                              {hakedis.hakedisNo}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {hakedis.subcontractor}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {contractTypeLabels[hakedis.contractType]}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-foreground">
                            {project?.projectCode}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {project?.projectName}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm text-foreground">
                          {hakedis.contractNo}
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">
                          {hakedis.approvalDate ? formatDate(hakedis.approvalDate) : '-'}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <StatusBadge status={hakedis.paymentStatus} />
                          {isPaid && hakedis.paidDate && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(hakedis.paidDate)}
                            </p>
                          )}
                        </td>
                        {isAccountant && (
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {!isPaid && (
                                <Button
                                  size="sm"
                                  onClick={() => handleMarkHakedisAsPaid(hakedis.id)}
                                  className="gap-1.5 bg-status-paid hover:bg-status-paid/90"
                                >
                                  <Banknote className="h-4 w-4" />
                                  Ödendi
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => generatePaymentPdf(hakedis)}
                                className="gap-1.5"
                              >
                                <FileDown className="h-4 w-4" />
                                PDF
                              </Button>
                            </div>
                          </td>
                        )}
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {sortedHakedisler.length === 0 && (
            <div className="p-12 text-center">
              <Wallet className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium text-foreground">Hakediş kaydı bulunamadı</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Arama kriterlerinize uygun onaylanmış hakediş bulunmuyor.
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
