import { useState, useMemo, useEffect } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { SortableTableHeader, useSorting } from '@/components/SortableTableHeader';
import { AmountCell } from '@/components/AmountCell';
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
  Eye,
  Pencil
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
import { loadPdfLibs, setupPdfFont, addCompanyHeader, addSectionTitle, addSignatureBlock, COLORS } from '@/utils/pdfSetup';
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
  const [vatEditDialogOpen, setVatEditDialogOpen] = useState(false);
  const [vatEditHakedisId, setVatEditHakedisId] = useState<string | null>(null);
  const [vatEditValue, setVatEditValue] = useState('');

  // Only show approved hakedisler
  const approvedHakedisler = subcontractorHakedisler.filter(h => h.approvalStatus === 'onaylandi');

  const filteredHakedisler = approvedHakedisler.filter(hakedis => {
    const project = projects.find(p => p.id === hakedis.projectId);
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query ||
      (hakedis.subcontractor || '').toLowerCase().includes(query) ||
      (hakedis.hakedisNo || '').toLowerCase().includes(query) ||
      (hakedis.contractNo || '').toLowerCase().includes(query) ||
      (project?.projectName || '').toLowerCase().includes(query) ||
      (project?.projectCode || '').toLowerCase().includes(query);
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
          comparison = (a.hakedisNo || '').localeCompare(b.hakedisNo || '');
          break;
        case 'project':
          comparison = (projectA?.projectCode || '').localeCompare(projectB?.projectCode || '');
          break;
        case 'contractNo':
          comparison = (a.contractNo || '').localeCompare(b.contractNo || '');
          break;
        case 'approvalDate':
          comparison = new Date(a.approvalDate || a.createdAt).getTime() - new Date(b.approvalDate || b.createdAt).getTime();
          break;
        case 'totalAmount':
          comparison = a.totalAmount - b.totalAmount;
          break;
        case 'paymentStatus':
          comparison = (a.paymentStatus || '').localeCompare(b.paymentStatus || '');
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
    
    try {
      const { jsPDF, autoTable } = await loadPdfLibs();
      
      const doc = new jsPDF('p', 'mm', 'a4');
      await setupPdfFont(doc);
      const pageWidth = doc.internal.pageSize.getWidth();
      
      let y = await addCompanyHeader(doc, 'ODEME RAPORU');
      
      // Hakedis Info
      y = addSectionTitle(doc, 'Hakedis Bilgileri', y, COLORS.primary);
      
      autoTable(doc, {
        startY: y,
        body: [
          ['Hakedis No', hakedis.hakedisNo],
          ['Sozlesme No', hakedis.contractNo || '-'],
          ['Altyuklenici', hakedis.subcontractor],
          ['Proje', `${project?.projectCode || '-'} - ${project?.projectName || '-'}`],
          ['Sozlesme Tipi', contractTypeLabels[hakedis.contractType]],
          ['Tarih', formatDate(hakedis.date)],
        ],
        theme: 'grid',
        styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
        alternateRowStyles: { fillColor: COLORS.lightGray },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
      
      // Financial Info
      y = addSectionTitle(doc, 'Tutar Bilgileri', y, COLORS.green);
      
      const finRows: any[][] = [
        ['Sozlesme Tutari', formatCurrencyWithType(contractAmount, hakedis.currency)],
        ['Hakedis Tutari', formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)],
        ['Odenen Tutar', formatCurrencyWithType(hakedis.paidAmount || 0, hakedis.currency)],
        ['Kalan Bakiye', formatCurrencyWithType(hakedis.totalAmount - (hakedis.paidAmount || 0), hakedis.currency)],
        ['Odeme Durumu', hakedis.paymentStatus === 'odendi' ? 'Odendi' : hakedis.paymentStatus === 'kismen_odendi' ? 'Kismen Odendi' : 'Odenmedi'],
      ];
      if (hakedis.paidDate) finRows.push(['Odeme Tarihi', formatDate(hakedis.paidDate)]);
      
      autoTable(doc, {
        startY: y,
        body: finRows,
        theme: 'grid',
        styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { halign: 'right' } },
        alternateRowStyles: { fillColor: COLORS.lightGray },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
      
      // Approval Info
      y = addSectionTitle(doc, 'Onay Bilgileri', y, COLORS.indigo);
      
      autoTable(doc, {
        startY: y,
        body: [
          ['Onay Durumu', 'Onaylandi'],
          ['Onaylayan', hakedis.approvedBy || '-'],
          ['Onay Tarihi', hakedis.approvalDate ? formatDate(hakedis.approvalDate) : '-'],
        ],
        theme: 'grid',
        styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 } },
        alternateRowStyles: { fillColor: COLORS.lightGray },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
      
      addSignatureBlock(doc, y);
      
      doc.save(`odeme-raporu-${hakedis.hakedisNo}.pdf`);
      toast.success('PDF raporu oluşturuldu');
    } catch (error) {
      console.error('PDF oluşturma hatası:', error);
      toast.error('PDF oluşturulamadı');
    }
  };

  const canManagePayments = currentUser.role === 'muhasebe' || currentUser.role === 'direktor';
  const canCancelApproval = currentUser.role === 'direktor' || currentUser.role === 'muhasebe';

  const handleVatUpdate = async () => {
    if (!vatEditHakedisId) return;
    const newVatRate = vatEditValue === '' ? 0 : parseFloat(vatEditValue);
    if (isNaN(newVatRate) || newVatRate < 0 || newVatRate > 100) {
      toast.error('Geçerli bir KDV oranı girin (0-100)');
      return;
    }
    try {
      await updateSubcontractorHakedis(vatEditHakedisId, { vatRate: newVatRate });
      const hakedis = subcontractorHakedisler.find(h => h.id === vatEditHakedisId);
      if (hakedis) {
        await addActivityLog(
          'hakedis_updated',
          `${hakedis.hakedisNo} hakediş KDV oranı güncellendi: %${newVatRate}`,
          `Altyüklenici: ${hakedis.subcontractor}`,
          vatEditHakedisId,
          'hakedis'
        );
      }
      toast.success(`KDV oranı %${newVatRate} olarak güncellendi`);
      setVatEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating VAT rate:', error);
      toast.error('KDV oranı güncellenemedi');
    }
  };

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
                  <SortableTableHeader label="Maliyet Tutarı" sortKey="totalAmount" currentSort={sortConfig} onSort={handleSort} align="right" />
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
                          <AmountCell totalAmount={hakedis.totalAmount} vatRate={hakedis.vatRate} currency={hakedis.currency} />
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
                    {contractAmount > 0 && (
                      <div className="flex justify-between text-sm border-b pb-2">
                        <span className="text-muted-foreground">Sözleşme Tutarı</span>
                        <span className="font-semibold">{formatCurrencyWithType(contractAmount, hakedis.currency)}</span>
                      </div>
                    )}
                    {(() => {
                      const vatRate = hakedis.vatRate || 0;
                      const kdvHaric = vatRate > 0 ? hakedis.totalAmount / (1 + vatRate / 100) : hakedis.totalAmount;
                      const kdvTutar = hakedis.totalAmount - kdvHaric;
                      return (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">KDV Hariç Tutar</span>
                            <span className="font-semibold">{formatCurrencyWithType(kdvHaric, hakedis.currency)}</span>
                          </div>
                          {vatRate > 0 && (
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">KDV (%{vatRate})</span>
                              <span className="font-semibold">{formatCurrencyWithType(kdvTutar, hakedis.currency)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm border-t pt-2">
                            <span className="text-muted-foreground font-medium">KDV Dahil Toplam</span>
                            <span className="font-bold">{formatCurrencyWithType(hakedis.totalAmount, hakedis.currency)}</span>
                          </div>
                        </>
                      );
                    })()}
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground">Ödenen Tutar</span>
                      <span className="font-semibold text-[hsl(var(--status-paid))]">{formatCurrencyWithType(paidSoFar, hakedis.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
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

