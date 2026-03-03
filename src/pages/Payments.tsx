import { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { SortableTableHeader, useSorting } from '@/components/SortableTableHeader';
import { useHakedisStore } from '@/store/hakedisStore';
import { formatCurrencyWithType, formatDate, contractTypeLabels, formatCurrency, Currency } from '@/types/hakedis';
import { 
  Search, 
  Wallet,
  Clock,
  AlertTriangle,
  Banknote,
  FileDown,
  RefreshCw,
  XCircle,
  CreditCard,
  FileSpreadsheet,
  Eye
} from 'lucide-react';
import { exportSinglePaymentToExcel } from '@/utils/excelExport';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

// Exchange rate types
type ExchangeRates = {
  [key: string]: number;
};

const fetchExchangeRates = async (): Promise<ExchangeRates> => {
  try {
    const response = await fetch('https://api.exchangerate-api.com/v4/latest/GBP');
    if (!response.ok) throw new Error('Failed to fetch exchange rates');
    const data = await response.json();
    return data.rates;
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return {};
  }
};

export default function Payments() {
  const { 
    projects, 
    workEntries,
    subcontractorHakedisler,
    markAsPaid,
    markHakedisAsPaid,
    updateSubcontractorHakedis,
    currentUser,
    addActivityLog
  } = useHakedisStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const { sortConfig, handleSort } = useSorting({ key: 'approvalDate', direction: 'desc' });
  const [activeTab, setActiveTab] = useState('hakedisler');
  const [partialPaymentDialogOpen, setPartialPaymentDialogOpen] = useState(false);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState('');
  const [selectedHakedisForPartial, setSelectedHakedisForPartial] = useState<string | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedHakedisForDetail, setSelectedHakedisForDetail] = useState<string | null>(null);

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

  // Exchange rates state
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({});
  const [isLoadingRates, setIsLoadingRates] = useState(true);

  // Fetch exchange rates on mount
  useEffect(() => {
    const loadRates = async () => {
      setIsLoadingRates(true);
      const rates = await fetchExchangeRates();
      setExchangeRates(rates);
      setIsLoadingRates(false);
    };
    loadRates();
  }, []);

  const refreshRates = async () => {
    setIsLoadingRates(true);
    const rates = await fetchExchangeRates();
    setExchangeRates(rates);
    setIsLoadingRates(false);
    toast.success('Döviz kurları güncellendi');
  };

  // Calculate total unpaid in GBP
  const totalUnpaidGBP = useMemo(() => {
    const unpaidHakedisler = approvedHakedisler.filter(h => h.paymentStatus !== 'odendi');
    
    return unpaidHakedisler.reduce((sum, h) => {
      const currency = h.currency as Currency;
      const remainingAmount = h.totalAmount - (h.paidAmount || 0);
      let amountInGBP = remainingAmount;
      
      if (currency === 'GBP') {
        amountInGBP = remainingAmount;
      } else if (exchangeRates[currency]) {
        amountInGBP = remainingAmount / exchangeRates[currency];
      }
      
      return sum + amountInGBP;
    }, 0);
  }, [approvedHakedisler, exchangeRates]);

  const handleMarkHakedisAsPaid = async (hakedisId: string) => {
    const hakedis = subcontractorHakedisler.find(h => h.id === hakedisId);
    try {
      await updateSubcontractorHakedis(hakedisId, {
        paymentStatus: 'odendi',
        paidAmount: hakedis?.totalAmount || 0,
        paidDate: new Date().toISOString(),
      });
      if (hakedis) {
        await addActivityLog(
          'hakedis_paid',
          `${hakedis.hakedisNo} hakediş tam ödendi olarak işaretlendi`,
          `Altyüklenici: ${hakedis.subcontractor} - Tutar: ${formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)}`,
          hakedisId,
          'hakedis'
        );
      }
      toast.success('Hakediş tam ödendi olarak işaretlendi');
    } catch (error) {
      console.error('Error marking hakedis as paid:', error);
      toast.error('Ödeme işlemi başarısız');
    }
  };

  const handlePartialPayment = async () => {
    if (!selectedHakedisForPartial) return;
    const hakedis = subcontractorHakedisler.find(h => h.id === selectedHakedisForPartial);
    if (!hakedis) return;

    const amount = parseFloat(partialPaymentAmount);
    const remaining = hakedis.totalAmount - (hakedis.paidAmount || 0);
    
    if (isNaN(amount) || amount <= 0) {
      toast.error('Geçerli bir tutar giriniz');
      return;
    }
    if (amount > remaining) {
      toast.error(`Tutar kalan bakiyeden (${formatCurrencyWithType(remaining, hakedis.currency)}) fazla olamaz`);
      return;
    }

    try {
      const newPaidAmount = (hakedis.paidAmount || 0) + amount;
      const isFullyPaid = newPaidAmount >= hakedis.totalAmount;
      
      await updateSubcontractorHakedis(selectedHakedisForPartial, {
        paidAmount: newPaidAmount,
        paymentStatus: isFullyPaid ? 'odendi' : 'kismen_odendi',
        paidDate: isFullyPaid ? new Date().toISOString() : hakedis.paidDate,
      });

      await addActivityLog(
        'hakedis_paid',
        `${hakedis.hakedisNo} hakediş kısmi ödeme yapıldı`,
        `Altyüklenici: ${hakedis.subcontractor} - Ödenen: ${formatCurrencyWithType(amount, hakedis.currency)} - Kalan: ${formatCurrencyWithType(hakedis.totalAmount - newPaidAmount, hakedis.currency)}`,
        selectedHakedisForPartial,
        'hakedis'
      );

      toast.success(`Kısmi ödeme kaydedildi: ${formatCurrencyWithType(amount, hakedis.currency)}`);
      setPartialPaymentDialogOpen(false);
      setPartialPaymentAmount('');
      setSelectedHakedisForPartial(null);
    } catch (error) {
      console.error('Error making partial payment:', error);
      toast.error('Kısmi ödeme işlemi başarısız');
    }
  };

  const generatePaymentPdf = async (hakedis: typeof approvedHakedisler[0]) => {
    const project = projects.find(p => p.id === hakedis.projectId);
    const contract = workEntries.find(e => e.id === hakedis.contractId);
    const contractAmount = contract?.totalAmount || 0;
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
              <td style="padding: 10px; border: 1px solid #ddd;">Sözleşme Tutarı</td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${formatCurrencyWithType(contractAmount, hakedis.currency)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Hakediş Tutarı</td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Ödenen Tutar</td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: #16a34a;">${formatCurrencyWithType(hakedis.paidAmount || 0, hakedis.currency)}</td>
            </tr>
            <tr style="background: #f9fafb;">
              <td style="padding: 10px; border: 1px solid #ddd;">Kalan Bakiye</td>
              <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold; color: ${(hakedis.totalAmount - (hakedis.paidAmount || 0)) > 0 ? '#d97706' : '#16a34a'};">${formatCurrencyWithType(hakedis.totalAmount - (hakedis.paidAmount || 0), hakedis.currency)}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd;">Ödeme Durumu</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${hakedis.paymentStatus === 'odendi' ? 'Ödendi' : hakedis.paymentStatus === 'kismen_odendi' ? 'Kısmen Ödendi' : 'Ödenmedi'}</td>
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

  const canManagePayments = currentUser.role === 'muhasebe' || currentUser.role === 'direktor';
  const canCancelApproval = currentUser.role === 'direktor';

  const handleCancelApproval = async (hakedisId: string) => {
    const hakedis = subcontractorHakedisler.find(h => h.id === hakedisId);
    try {
      await updateSubcontractorHakedis(hakedisId, {
        approvalStatus: 'revize',
        approvedBy: undefined,
        approvalDate: undefined,
        rejectionReason: 'Direktör tarafından onay iptal edildi',
      });
      if (hakedis) {
        await addActivityLog(
          'hakedis_rejected',
          `${hakedis.hakedisNo} hakediş onayı iptal edildi`,
          `Altyüklenici: ${hakedis.subcontractor} - Tutar: ${formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)}`,
          hakedisId,
          'hakedis'
        );
      }
      toast.success('Hakediş onayı iptal edildi, durum "Revize Gerekli" olarak güncellendi');
    } catch (error) {
      console.error('Error cancelling approval:', error);
      toast.error('Onay iptali başarısız');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Ödemeler</h1>
            <p className="page-subtitle">
              Onaylanmış hakedişlerin ödeme takibi
            </p>
          </div>
        </div>

        {/* Summary Card - Only Pending Payments */}
        <div className="grid grid-cols-1 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="stat-card"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-[hsl(var(--status-pending-bg))] p-2 sm:p-2.5">
                  <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-[hsl(var(--status-pending))]" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Bekleyen Ödeme (GBP)</p>
                  <p className="text-lg sm:text-xl font-semibold text-[hsl(var(--status-pending))]">
                    {isLoadingRates ? (
                      <span className="text-muted-foreground">Yükleniyor...</span>
                    ) : (
                      `£${totalUnpaidGBP.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    )}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
                    {approvedHakedisler.filter(h => h.paymentStatus !== 'odendi').length} adet bekleyen hakediş
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshRates}
                disabled={isLoadingRates}
                className="gap-1.5 touch-target self-end sm:self-auto"
              >
                <RefreshCw className={`h-4 w-4 ${isLoadingRates ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Kurları Güncelle</span>
                <span className="sm:hidden">Güncelle</span>
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Info Banner for users without payment permission */}
        {!canManagePayments && (
          <div className="flex items-start sm:items-center gap-3 rounded-lg border border-primary/30 bg-accent p-3 sm:p-4">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-xs sm:text-sm text-foreground">
              Ödeme işlemleri sadece <strong>Direktör</strong> ve <strong>Muhasebe</strong> rolündeki kullanıcılar tarafından yapılabilir.
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
              <SelectItem value="kismen_odendi">Kısmen Ödendi</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Hakedisler Table */}
        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
              <tr className="border-b bg-muted/50">
                  <SortableTableHeader label="Proje" sortKey="project" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Altyüklenici" sortKey="subcontractor" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Onay Tarihi" sortKey="approvalDate" currentSort={sortConfig} onSort={handleSort} />
                  <SortableTableHeader label="Toplam Tutar" sortKey="totalAmount" currentSort={sortConfig} onSort={handleSort} align="right" />
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Ödenen</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Kalan</th>
                  <SortableTableHeader label="Ödeme Durumu" sortKey="paymentStatus" currentSort={sortConfig} onSort={handleSort} align="center" />
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">Detay</th>
                  {canManagePayments && (
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
                    const paidAmount = hakedis.paidAmount || 0;
                    const remainingAmount = hakedis.totalAmount - paidAmount;
                    
                    return (
                      <motion.tr
                        key={hakedis.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="group hover:bg-muted/30"
                      >
                        <td className="px-4 py-4">
                          <p className="text-sm font-medium text-foreground">
                            {project?.projectCode}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {project?.projectName}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-sm text-foreground">
                          {hakedis.subcontractor}
                        </td>
                        <td className="px-4 py-4 text-sm text-muted-foreground">
                          {hakedis.approvalDate ? formatDate(hakedis.approvalDate) : '-'}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="text-sm font-semibold text-foreground">
                            {formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className={`text-sm font-medium ${paidAmount > 0 ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {formatCurrencyWithType(paidAmount, hakedis.currency)}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className={`text-sm font-semibold ${remainingAmount > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                            {formatCurrencyWithType(remainingAmount, hakedis.currency)}
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
                        <td className="px-4 py-4 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedHakedisForDetail(hakedis.id);
                              setDetailDialogOpen(true);
                            }}
                            className="gap-1.5"
                          >
                            <Eye className="h-4 w-4" />
                            Detay
                          </Button>
                        </td>
                        {canManagePayments && (
                          <td className="px-4 py-4 text-center">
                            <div className="flex items-center justify-center gap-2 flex-wrap">
                              {!isPaid && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleMarkHakedisAsPaid(hakedis.id)}
                                    className="gap-1.5 bg-status-paid hover:bg-status-paid/90"
                                  >
                                    <Banknote className="h-4 w-4" />
                                    Tam Ödeme
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => {
                                      setSelectedHakedisForPartial(hakedis.id);
                                      setPartialPaymentAmount('');
                                      setPartialPaymentDialogOpen(true);
                                    }}
                                    className="gap-1.5"
                                  >
                                    <CreditCard className="h-4 w-4" />
                                    Kısmi Ödeme
                                  </Button>
                                </>
                              )}
                              {canCancelApproval && !isPaid && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleCancelApproval(hakedis.id)}
                                  className="gap-1.5"
                                >
                                  <XCircle className="h-4 w-4" />
                                  Onay İptali
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
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const project = projects.find(p => p.id === hakedis.projectId);
                                  const contract = workEntries.find(c => c.id === hakedis.contractId);
                                  exportSinglePaymentToExcel(hakedis, project, contract);
                                }}
                                className="gap-1.5"
                              >
                                <FileSpreadsheet className="h-4 w-4" />
                                Excel
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

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Hakediş Detayı</DialogTitle>
            </DialogHeader>
            {selectedHakedisForDetail && (() => {
              const hakedis = subcontractorHakedisler.find(h => h.id === selectedHakedisForDetail);
              if (!hakedis) return null;
              const project = projects.find(p => p.id === hakedis.projectId);
              const contract = workEntries.find(c => c.id === hakedis.contractId);
              const contractAmount = contract?.totalAmount || 0;
              const paidSoFar = hakedis.paidAmount || 0;
              const remaining = hakedis.totalAmount - paidSoFar;
              return (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Genel Bilgiler</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Hakediş No</span>
                        <span className="text-sm font-medium">{hakedis.hakedisNo}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Sözleşme No</span>
                        <span className="text-sm font-medium">{hakedis.contractNo}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Altyüklenici</span>
                        <span className="text-sm font-medium">{hakedis.subcontractor}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Proje</span>
                        <span className="text-sm font-medium">{project?.projectCode} - {project?.projectName}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Sözleşme Tipi</span>
                        <span className="text-sm font-medium">{contractTypeLabels[hakedis.contractType]}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Tarih</span>
                        <span className="text-sm font-medium">{formatDate(hakedis.date)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Onaylayan</span>
                        <span className="text-sm font-medium">{hakedis.approvedBy || '-'}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-muted-foreground">Onay Tarihi</span>
                        <span className="text-sm font-medium">{hakedis.approvalDate ? formatDate(hakedis.approvalDate) : '-'}</span>
                      </div>
                    </div>
                    {hakedis.description && (
                      <div className="mt-2 pt-2 border-t">
                        <span className="text-xs text-muted-foreground">Açıklama</span>
                        <p className="text-sm mt-0.5">{hakedis.description}</p>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Finansal Özet</h3>
                    <div className="flex justify-between text-sm border-b pb-2">
                      <span className="text-muted-foreground">Sözleşme Tutarı</span>
                      <span className="font-semibold">{formatCurrencyWithType(contractAmount, hakedis.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Hakediş Tutarı</span>
                      <span className="font-semibold">{formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Ödenen Tutar</span>
                      <span className="font-semibold text-[hsl(var(--status-paid))]">{formatCurrencyWithType(paidSoFar, hakedis.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground font-medium">Kalan Bakiye</span>
                      <span className={`font-bold ${remaining > 0 ? 'text-[hsl(var(--status-pending))]' : 'text-[hsl(var(--status-paid))]'}`}>
                        {formatCurrencyWithType(remaining, hakedis.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm pt-1">
                      <span className="text-muted-foreground">Ödeme Durumu</span>
                      <StatusBadge status={hakedis.paymentStatus} />
                    </div>
                    {hakedis.paidDate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Ödeme Tarihi</span>
                        <span className="font-medium">{formatDate(hakedis.paidDate)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>
                Kapat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Partial Payment Dialog */}
        <Dialog open={partialPaymentDialogOpen} onOpenChange={setPartialPaymentDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Kısmi Ödeme</DialogTitle>
            </DialogHeader>
            {selectedHakedisForPartial && (() => {
              const hakedis = subcontractorHakedisler.find(h => h.id === selectedHakedisForPartial);
              if (!hakedis) return null;
              const paidSoFar = hakedis.paidAmount || 0;
              const remaining = hakedis.totalAmount - paidSoFar;
              return (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Hakediş No:</span>
                      <span className="font-medium">{hakedis.hakedisNo}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Toplam Tutar:</span>
                      <span className="font-medium">{formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Ödenen:</span>
                      <span className="font-medium text-[hsl(var(--status-paid))]">{formatCurrencyWithType(paidSoFar, hakedis.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground font-medium">Kalan Bakiye:</span>
                      <span className="font-semibold text-[hsl(var(--status-pending))]">{formatCurrencyWithType(remaining, hakedis.currency)}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Ödenecek Tutar</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={partialPaymentAmount}
                      onChange={(e) => setPartialPaymentAmount(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maksimum: {formatCurrencyWithType(remaining, hakedis.currency)}
                    </p>
                  </div>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => setPartialPaymentDialogOpen(false)}>
                İptal
              </Button>
              <Button onClick={handlePartialPayment} className="gap-1.5">
                <CreditCard className="h-4 w-4" />
                Ödemeyi Kaydet
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}

