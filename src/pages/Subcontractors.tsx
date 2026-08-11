import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/MainLayout';
import { sortNatural } from '@/lib/utils';
import { StatusBadge } from '@/components/StatusBadge';
import { AmountCell } from '@/components/AmountCell';
import { useHakedisStore } from '@/store/hakedisStore';
import {
  formatCurrencyWithType,
  formatDate,
  contractTypeLabels,
  Currency,
  PaymentStatus,
  ApprovalStatus,
  paymentStatusLabels,
} from '@/types/hakedis';
import { useWorkCategories } from '@/hooks/useWorkCategories';
import { generateContractPDF, generateHakedisPDF, generateSubcontractorPDF } from '@/utils/pdfGenerator';
import {
  exportSingleContractToExcel,
  exportSingleHakedisToExcel,
  exportSubcontractorReportToExcel,
} from '@/utils/excelExport';
import {
  getSubcontractorLedgers,
  type SubcontractorLedger,
  type LedgerMovement,
} from '@/utils/contractAccounting';

import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Search,
  Users,
  FileText,
  Wallet,
  ClipboardList,
  Eye,
  Pencil,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  FolderKanban,
  CheckCircle2,
  CircleDollarSign,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

type DeleteTarget =
  | { kind: 'contract'; id: string; label: string }
  | { kind: 'hakedis'; id: string; label: string }
  | null;

export default function Subcontractors() {
  const {
    subcontractors,
    workEntries,
    subcontractorHakedisler,
    projects,
    currentUser,
    deleteWorkEntry,
    deleteSubcontractorHakedis,
    addActivityLog,
  } = useHakedisStore();
  const { categories: workCategories } = useWorkCategories();
  const navigate = useNavigate();

  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [itemSearch, setItemSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const canDelete = currentUser.role === 'direktor';

  // Build subcontractor list from records
  const subcontractorStats = useMemo(() => {
    const map = new Map<
      string,
      { name: string; contracts: number; hakedisler: number }
    >();
    const ensure = (name: string) => {
      if (!map.has(name)) {
        map.set(name, { name, contracts: 0, hakedisler: 0 });
      }
      return map.get(name)!;
    };
    workEntries.forEach((c) => ensure(c.subcontractor).contracts++);
    subcontractorHakedisler.forEach((h) => ensure(h.subcontractor).hakedisler++);
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'tr')
    );
  }, [workEntries, subcontractorHakedisler]);

  const filteredSubs = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('tr');
    if (!term) return subcontractorStats;
    return subcontractorStats.filter((s) =>
      s.name.toLocaleLowerCase('tr').includes(term)
    );
  }, [subcontractorStats, search]);

  const projectName = (id?: string) =>
    projects.find((p) => p.id === id)?.projectName || '-';

  // Derive contract approval/payment status from associated hakedisler (source of truth)
  const deriveContractStatus = (contractId: string, contractTotal: number) => {
    const related = subcontractorHakedisler.filter(
      (h) => h.contractId === contractId
    );
    const hakedisTotal = related.reduce((s, h) => s + (h.totalAmount || 0), 0);
    const paid = related.reduce((s, h) => s + (h.paidAmount || 0), 0);

    let approvalStatus: ApprovalStatus = 'onay_bekliyor';
    if (related.length > 0 && related.every((h) => h.approvalStatus === 'onaylandi')) {
      approvalStatus = 'onaylandi';
    } else if (related.some((h) => h.approvalStatus === 'revize')) {
      approvalStatus = 'revize';
    }

    let paymentStatus: PaymentStatus = 'odenmedi';
    if (paid > 0 && paid >= (contractTotal || hakedisTotal) && contractTotal > 0) {
      paymentStatus = 'odendi';
    } else if (paid > 0) {
      paymentStatus = 'kismen_odendi';
    }

    return { approvalStatus, paymentStatus, hakedisTotal, paid };
  };

  const subContracts = useMemo(() => {
    if (!selected) return [];
    return workEntries
      .filter((c) => c.subcontractor === selected)
      .filter((c) => projectFilter === 'all' || c.projectId === projectFilter)
      .filter((c) => categoryFilter === 'all' || c.workCategory === categoryFilter)
      .map((c) => ({ c, derived: deriveContractStatus(c.id, c.totalAmount || 0) }))
      .filter(
        ({ derived }) =>
          paymentFilter === 'all' || derived.paymentStatus === paymentFilter
      )
      .filter(({ c }) => {
        const term = itemSearch.trim().toLocaleLowerCase('tr');
        if (!term) return true;
        return (
          (c.contractNo || '').toLocaleLowerCase('tr').includes(term) ||
          (c.description || '').toLocaleLowerCase('tr').includes(term) ||
          (c.workCategory || '').toLocaleLowerCase('tr').includes(term)
        );
      })
      .sort((a, b) => (b.c.date || '').localeCompare(a.c.date || ''));
  }, [
    selected,
    workEntries,
    subcontractorHakedisler,
    projectFilter,
    categoryFilter,
    paymentFilter,
    itemSearch,
  ]);

  const subHakedisler = useMemo(() => {
    if (!selected) return [];
    return subcontractorHakedisler
      .filter((h) => h.subcontractor === selected)
      .filter((h) => projectFilter === 'all' || h.projectId === projectFilter)
      .filter((h) => {
        if (categoryFilter === 'all') return true;
        const c = workEntries.find((w) => w.id === h.contractId);
        return c?.workCategory === categoryFilter;
      })
      .filter((h) => paymentFilter === 'all' || h.paymentStatus === paymentFilter)
      .filter((h) => {
        const term = itemSearch.trim().toLocaleLowerCase('tr');
        if (!term) return true;
        return (
          (h.hakedisNo || '').toLocaleLowerCase('tr').includes(term) ||
          (h.contractNo || '').toLocaleLowerCase('tr').includes(term) ||
          (h.description || '').toLocaleLowerCase('tr').includes(term)
        );
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [
    selected,
    subcontractorHakedisler,
    workEntries,
    projectFilter,
    categoryFilter,
    paymentFilter,
    itemSearch,
  ]);

  // Totals by currency (KDV hariç + KDV dahil)
  const totals = useMemo(() => {
    const withVat = (amount: number, vatRate?: number | null) =>
      amount * (1 + (vatRate && vatRate > 0 ? vatRate : 0) / 100);
    const contractByCur: Record<string, number> = {};
    const hakedisByCur: Record<string, number> = {};
    const paidByCur: Record<string, number> = {};
    const contractByCurIncl: Record<string, number> = {};
    const hakedisByCurIncl: Record<string, number> = {};
    const paidByCurIncl: Record<string, number> = {};
    subContracts.forEach(({ c }) => {
      contractByCur[c.currency] =
        (contractByCur[c.currency] || 0) + (c.totalAmount || 0);
      contractByCurIncl[c.currency] =
        (contractByCurIncl[c.currency] || 0) + withVat(c.totalAmount || 0, c.vatRate);
    });
    subHakedisler.forEach((h) => {
      hakedisByCur[h.currency] =
        (hakedisByCur[h.currency] || 0) + (h.totalAmount || 0);
      hakedisByCurIncl[h.currency] =
        (hakedisByCurIncl[h.currency] || 0) + withVat(h.totalAmount || 0, h.vatRate);
      paidByCur[h.currency] =
        (paidByCur[h.currency] || 0) + (h.paidAmount || 0);
      paidByCurIncl[h.currency] =
        (paidByCurIncl[h.currency] || 0) + withVat(h.paidAmount || 0, h.vatRate);
    });
    return {
      contractByCur,
      hakedisByCur,
      paidByCur,
      contractByCurIncl,
      hakedisByCurIncl,
      paidByCurIncl,
    };
  }, [subContracts, subHakedisler]);

  // İş dosyaları (altyüklenici + proje + para birimi bazlı cari hesap defteri)
  const ledgers: SubcontractorLedger[] = useMemo(() => {
    if (!selected) return [];
    return getSubcontractorLedgers(
      selected,
      workEntries,
      subcontractorHakedisler,
      (id?: string) => {
        const p = projects.find((x) => x.id === id);
        return { name: p?.projectName || 'Proje belirtilmemiş', code: p?.projectCode };
      }
    );
  }, [selected, workEntries, subcontractorHakedisler, projects]);



  // Sözleşmenin kalan bakiyesi kadar hakediş oluşturmak için hakediş sayfasına yönlendir
  const handleCloseRemaining = (led: SubcontractorLedger) => {
    const candidates = led.contracts
      .map((c) => {
        const related = subcontractorHakedisler.filter((h) => h.contractId === c.id);
        const used = related.reduce((s, h) => s + (h.totalAmount || 0), 0);
        return { c, remaining: (c.totalAmount || 0) - used };
      })
      .filter((x) => x.remaining > 0.5)
      .sort((a, b) => b.remaining - a.remaining);

    if (candidates.length === 0) {
      toast.info('Bu iş dosyasında kapatılacak sözleşme bakiyesi yok');
      return;
    }
    const target = candidates[0];
    if (candidates.length > 1) {
      toast.info(`En yüksek bakiyeli sözleşme seçildi: ${target.c.contractNo}`);
    }
    navigate(`/altyuklenici-hakedis?closeContract=${target.c.id}`);
  };

  const resetFilters = () => {
    setProjectFilter('all');
    setCategoryFilter('all');
    setPaymentFilter('all');
    setItemSearch('');
  };

  // ----- Action handlers -----
  const handleContractPdf = async (contractId: string) => {
    const entry = workEntries.find((w) => w.id === contractId);
    if (!entry) return;
    try {
      const project = projects.find((p) => p.id === entry.projectId);
      await generateContractPDF(entry, project, subcontractorHakedisler);
      toast.success('PDF rapor indirildi');
    } catch {
      toast.error('PDF oluşturulamadı');
    }
  };

  const handleContractExcel = (contractId: string) => {
    const entry = workEntries.find((w) => w.id === contractId);
    if (!entry) return;
    const project = projects.find((p) => p.id === entry.projectId);
    exportSingleContractToExcel(entry, project, subcontractorHakedisler);
  };

  const handleHakedisPdf = async (hakedisId: string) => {
    const h = subcontractorHakedisler.find((x) => x.id === hakedisId);
    if (!h) return;
    try {
      const project = projects.find((p) => p.id === h.projectId);
      const contract = workEntries.find((c) => c.id === h.contractId);
      await generateHakedisPDF(h, project, contract, subcontractorHakedisler);
      toast.success('PDF rapor indirildi');
    } catch {
      toast.error('PDF oluşturulamadı');
    }
  };

  const handleHakedisExcel = (hakedisId: string) => {
    const h = subcontractorHakedisler.find((x) => x.id === hakedisId);
    if (!h) return;
    const project = projects.find((p) => p.id === h.projectId);
    const contract = workEntries.find((c) => c.id === h.contractId);
    exportSingleHakedisToExcel(h, project, contract, subcontractorHakedisler);
  };

  // Aggregated subcontractor report (uses current filters)
  const buildReportFilters = () => ({
    projectName: projectFilter === 'all' ? 'all' : (projects.find(p => p.id === projectFilter)?.projectName || projectFilter),
    workCategory: categoryFilter,
    paymentStatus: paymentFilter === 'all' ? 'all' : paymentStatusLabels[paymentFilter as PaymentStatus],
    search: itemSearch || undefined,
  });

  const handleSubcontractorPdf = async () => {
    if (!selected) return;
    try {
      await generateSubcontractorPDF(
        selected,
        subContracts.map(s => s.c),
        subHakedisler,
        projects,
        buildReportFilters()
      );
      toast.success('Altyüklenici PDF raporu indirildi');
    } catch (e) {
      console.error(e);
      toast.error('PDF oluşturulamadı');
    }
  };

  const handleSubcontractorExcel = async () => {
    if (!selected) return;
    try {
      await exportSubcontractorReportToExcel(
        selected,
        subContracts.map(s => s.c),
        subHakedisler,
        projects,
        buildReportFilters()
      );
    } catch (e) {
      console.error(e);
      toast.error('Excel oluşturulamadı');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.kind === 'contract') {
        await deleteWorkEntry(deleteTarget.id);
        await addActivityLog(
          'contract_deleted',
          `${deleteTarget.label} sözleşmesi silindi`,
          undefined,
          deleteTarget.id,
          'contract'
        );
        toast.success('Sözleşme silindi');
      } else {
        await deleteSubcontractorHakedis(deleteTarget.id);
        await addActivityLog(
          'hakedis_deleted',
          `${deleteTarget.label} hakedişi silindi`,
          undefined,
          deleteTarget.id,
          'hakedis'
        );
        toast.success('Hakediş silindi');
      }
    } catch (e) {
      console.error(e);
      toast.error('Silme işlemi başarısız');
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Altyükleniciler
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Altyüklenici bazında sözleşme ve hakediş geçmişi
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          {/* Sub list */}
          <Card className="h-fit">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Altyüklenici Listesi</CardTitle>
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Altyüklenici ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>
            <CardContent className="p-2 max-h-[70vh] overflow-y-auto">
              {filteredSubs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Kayıt bulunamadı
                </p>
              ) : (
                <ul className="space-y-1">
                  {filteredSubs.map((s) => {
                    const active = selected === s.name;
                    return (
                      <li key={s.name}>
                        <button
                          onClick={() => {
                            setSelected(s.name);
                            resetFilters();
                          }}
                          className={`w-full text-left rounded-md px-3 py-2 transition-colors ${
                            active
                              ? 'bg-primary/10 text-primary'
                              : 'hover:bg-muted'
                          }`}
                        >
                          <div className="font-medium text-sm truncate">
                            {s.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex gap-3">
                            <span className="inline-flex items-center gap-1">
                              <ClipboardList className="h-3 w-3" />
                              {s.contracts}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {s.hakedisler}
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Detail */}
          <div className="space-y-4">
            {!selected ? (
              <Card>
                <CardContent className="py-16 text-center text-muted-foreground">
                  Görüntülemek için bir altyüklenici seçin
                </CardContent>
              </Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3 space-y-0">
                    <CardTitle className="text-lg">{selected}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleSubcontractorPdf}
                        title="Filtrelenmiş kayıtları PDF olarak indir">
                        <FileText className="h-4 w-4 mr-1.5" />
                        PDF Rapor
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleSubcontractorExcel}
                        title="Filtrelenmiş kayıtları Excel olarak indir">
                        <FileSpreadsheet className="h-4 w-4 mr-1.5" />
                        Excel Rapor
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Filters */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Ara (no, açıklama)..."
                          value={itemSearch}
                          onChange={(e) => setItemSearch(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Select value={projectFilter} onValueChange={setProjectFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Proje" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tüm Projeler</SelectItem>
                          {sortNatural(projects, (p) => p.projectCode).map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.projectCode} - {p.projectName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="İş Kalemi" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tüm İş Kalemleri</SelectItem>
                          {sortNatural([...workCategories], (c) => c).map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Ödeme Durumu" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tüm Ödeme Durumları</SelectItem>
                          <SelectItem value="odendi">{paymentStatusLabels.odendi}</SelectItem>
                          <SelectItem value="kismen_odendi">{paymentStatusLabels.kismen_odendi}</SelectItem>
                          <SelectItem value="odenmedi">{paymentStatusLabels.odenmedi}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Totals */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <SummaryBox
                        icon={<ClipboardList className="h-4 w-4" />}
                        title="Sözleşme Toplamı"
                        amounts={totals.contractByCur}
                        amountsIncl={totals.contractByCurIncl}
                      />
                      <SummaryBox
                        icon={<FileText className="h-4 w-4" />}
                        title="Hakediş Toplamı"
                        amounts={totals.hakedisByCur}
                        amountsIncl={totals.hakedisByCurIncl}
                      />
                      <SummaryBox
                        icon={<Wallet className="h-4 w-4" />}
                        title="Ödenen"
                        amounts={totals.paidByCur}
                        amountsIncl={totals.paidByCurIncl}
                      />
                    </div>

                    {/* İş Dosyaları (Cari Hesap) */}
                    {ledgers.length > 0 && (
                      <div className="space-y-2 pt-2">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <FolderKanban className="h-4 w-4 text-primary" />
                          İş Dosyaları (Cari Hesap)
                          <span className="text-xs font-normal text-muted-foreground">
                            (proje + para birimi bazında, sözleşmeli ve sözleşmesiz tüm hareketler)
                          </span>
                        </div>
                        <div className="space-y-3">
                          {ledgers.map((led) => (
                            <LedgerCard
                              key={led.key}
                              ledger={led}
                              active={projectFilter === led.projectId}
                              onFilter={() =>
                                setProjectFilter(
                                  projectFilter === led.projectId ? 'all' : led.projectId
                                )
                              }
                              onCloseRemaining={() => handleCloseRemaining(led)}
                              onOpenHakedis={(id) =>
                                navigate(`/altyuklenici-hakedis?view=${id}`)
                              }
                            />
                          ))}
                        </div>
                      </div>
                    )}

                  </CardContent>
                </Card>


                <Tabs defaultValue="contracts">
                  <TabsList>
                    <TabsTrigger value="contracts">
                      Sözleşmeler ({subContracts.length})
                    </TabsTrigger>
                    <TabsTrigger value="hakedisler">
                      Hakedişler ({subHakedisler.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="contracts">
                    <Card>
                      <CardContent className="p-0 overflow-x-auto">
                        {subContracts.length === 0 ? (
                          <div className="py-12 text-center text-muted-foreground text-sm">
                            Sözleşme bulunamadı
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Sözleşme No</TableHead>
                                <TableHead>Tarih</TableHead>
                                <TableHead>Proje</TableHead>
                                <TableHead>İş Kalemi</TableHead>
                                <TableHead>Tür</TableHead>
                                <TableHead className="text-right">Sözleşme Tutarı</TableHead>
                                <TableHead className="text-right">Hakediş / Ödenen</TableHead>
                                <TableHead>Onay</TableHead>
                                <TableHead>Ödeme</TableHead>
                                <TableHead className="text-center">İşlem</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {subContracts.map(({ c, derived }) => (
                                <TableRow key={c.id}>
                                  <TableCell className="font-medium">{c.contractNo}</TableCell>
                                  <TableCell>{formatDate(c.date)}</TableCell>
                                  <TableCell>{projectName(c.projectId)}</TableCell>
                                  <TableCell>{c.workCategory}</TableCell>
                                  <TableCell>{contractTypeLabels[c.contractType]}</TableCell>
                                  <TableCell className="text-right">
                                    <AmountCell
                                      className="text-right"
                                      totalAmount={c.totalAmount || 0}
                                      vatRate={c.vatRate}
                                      currency={c.currency as Currency}
                                    />
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-xs space-y-1">
                                    <div>
                                      <div className="font-medium">
                                        {formatCurrencyWithType(derived.hakedisTotal * (1 + (c.vatRate || 0) / 100), c.currency as Currency)}
                                        <span className="ml-1 text-[10px] text-muted-foreground">(KDV Dahil)</span>
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">
                                        KDV Hariç: {formatCurrencyWithType(derived.hakedisTotal, c.currency as Currency)}
                                      </div>
                                    </div>
                                    <div>
                                      <div className="font-medium text-primary">
                                        {formatCurrencyWithType(derived.paid * (1 + (c.vatRate || 0) / 100), c.currency as Currency)}
                                        <span className="ml-1 text-[10px] text-muted-foreground">(Ödenen, KDV Dahil)</span>
                                      </div>
                                      <div className="text-[11px] text-muted-foreground">
                                        KDV Hariç: {formatCurrencyWithType(derived.paid, c.currency as Currency)}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell><StatusBadge status={derived.approvalStatus} size="sm" /></TableCell>
                                  <TableCell><StatusBadge status={derived.paymentStatus} size="sm" /></TableCell>
                                  <TableCell>
                                    <div className="flex items-center justify-center gap-0.5">
                                      <Button variant="ghost" size="sm" title="Detay"
                                        onClick={() => navigate(`/yapilanisler?view=${c.id}`)}>
                                        <Eye className="h-4 w-4" />
                                      </Button>
                                      {(currentUser.role === 'direktor' || currentUser.role === 'muhasebe') && (
                                        <Button variant="ghost" size="sm" title="Düzenle"
                                          onClick={() => navigate(`/yapilanisler?edit=${c.id}`)}>
                                          <Pencil className="h-4 w-4" />
                                        </Button>
                                      )}
                                      <Button variant="ghost" size="sm" title="PDF"
                                        onClick={() => handleContractPdf(c.id)}>
                                        <FileText className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="sm" title="Excel"
                                        onClick={() => handleContractExcel(c.id)}>
                                        <FileSpreadsheet className="h-4 w-4" />
                                      </Button>
                                      {canDelete && (
                                        <Button variant="ghost" size="sm" title="Sil"
                                          className="text-destructive hover:text-destructive"
                                          onClick={() => setDeleteTarget({ kind: 'contract', id: c.id, label: c.contractNo })}>
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="hakedisler">
                    <Card>
                      <CardContent className="p-0 overflow-x-auto">
                        {subHakedisler.length === 0 ? (
                          <div className="py-12 text-center text-muted-foreground text-sm">
                            Hakediş bulunamadı
                          </div>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Hakediş No</TableHead>
                                <TableHead>Tarih</TableHead>
                                <TableHead>Proje</TableHead>
                                <TableHead>Sözleşme No</TableHead>
                                <TableHead className="text-right">Tutar</TableHead>
                                <TableHead className="text-right">Ödenen</TableHead>
                                <TableHead>Onay</TableHead>
                                <TableHead>Ödeme</TableHead>
                                <TableHead className="text-center">İşlem</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {subHakedisler.map((h) => {
                                const editable =
                                  currentUser.role === 'direktor' ||
                                  h.approvalStatus === 'onay_bekliyor' ||
                                  h.approvalStatus === 'revize';
                                return (
                                  <TableRow key={h.id}>
                                    <TableCell className="font-medium">{h.hakedisNo}</TableCell>
                                    <TableCell>{formatDate(h.date)}</TableCell>
                                    <TableCell>{projectName(h.projectId)}</TableCell>
                                    <TableCell>{h.contractNo || '-'}</TableCell>
                                    <TableCell className="text-right">
                                      <AmountCell
                                        className="text-right"
                                        totalAmount={h.totalAmount || 0}
                                        vatRate={h.vatRate}
                                        currency={h.currency as Currency}
                                      />
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <AmountCell
                                        className="text-right"
                                        totalAmount={h.paidAmount || 0}
                                        vatRate={h.vatRate}
                                        currency={h.currency as Currency}
                                      />
                                    </TableCell>
                                    <TableCell><StatusBadge status={h.approvalStatus} size="sm" /></TableCell>
                                    <TableCell><StatusBadge status={h.paymentStatus} size="sm" /></TableCell>
                                    <TableCell>
                                      <div className="flex items-center justify-center gap-0.5">
                                        <Button variant="ghost" size="sm" title="Detay"
                                          onClick={() => navigate(`/hakedisler?view=${h.id}`)}>
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        {editable && (
                                          <Button variant="ghost" size="sm" title="Düzenle"
                                            onClick={() => navigate(`/hakedisler?edit=${h.id}`)}>
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                        )}
                                        <Button variant="ghost" size="sm" title="PDF"
                                          onClick={() => handleHakedisPdf(h.id)}>
                                          <FileText className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="sm" title="Excel"
                                          onClick={() => handleHakedisExcel(h.id)}>
                                          <FileSpreadsheet className="h-4 w-4" />
                                        </Button>
                                        {canDelete && (
                                          <Button variant="ghost" size="sm" title="Sil"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => setDeleteTarget({ kind: 'hakedis', id: h.id, label: h.hakedisNo })}>
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Silmek istediğinize emin misiniz?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === 'contract'
                ? `"${deleteTarget?.label}" numaralı sözleşme silinecek. Bu işlem geri alınamaz.`
                : `"${deleteTarget?.label}" numaralı hakediş silinecek. Bu işlem geri alınamaz.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

function SummaryBox({
  icon,
  title,
  amounts,
  amountsIncl,
}: {
  icon: React.ReactNode;
  title: string;
  amounts: Record<string, number>;
  amountsIncl?: Record<string, number>;
}) {
  const entries = Object.entries(amounts).filter(([, v]) => v > 0);
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <div className="mt-1.5 space-y-1.5">
        {entries.length === 0 ? (
          <div className="text-sm text-muted-foreground">—</div>
        ) : (
          entries.map(([cur, val]) => (
            <div key={cur} className="tabular-nums">
              <div className="text-sm font-semibold">
                {formatCurrencyWithType(amountsIncl?.[cur] ?? val, cur as Currency)}
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                  (KDV Dahil)
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground leading-tight">
                KDV Hariç: {formatCurrencyWithType(val, cur as Currency)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function LedgerCard({
  ledger,
  active,
  onFilter,
  onCloseRemaining,
  onOpenHakedis,
}: {
  ledger: SubcontractorLedger;
  active: boolean;
  onFilter: () => void;
  onCloseRemaining: () => void;
  onOpenHakedis: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const c = ledger.currency;

  const Row = ({
    label,
    excl,
    incl,
    valueClass = 'text-foreground',
    bordered = false,
    hint,
  }: {
    label: string;
    excl: number;
    incl: number;
    valueClass?: string;
    bordered?: boolean;
    hint?: string;
  }) => (
    <div className={`flex justify-between gap-2 ${bordered ? 'border-t pt-1 mt-1' : ''}`}>
      <span className="text-muted-foreground">
        {label}
        {hint && <span className="ml-1 text-[10px] text-amber-600">{hint}</span>}
      </span>
      <span className="text-right">
        <span className={`block font-medium ${valueClass}`}>
          {formatCurrencyWithType(incl, c)}
        </span>
        <span className="block text-[10px] text-muted-foreground leading-tight">
          Hariç: {formatCurrencyWithType(excl, c)}
        </span>
      </span>
    </div>
  );

  return (
    <div
      className={`rounded-lg border transition-colors ${
        active ? 'border-primary bg-primary/5' : 'bg-card'
      }`}
    >
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onFilter}
              className="text-sm font-semibold text-foreground hover:text-primary text-left"
            >
              {ledger.projectCode ? `${ledger.projectCode} - ` : ''}
              {ledger.projectName}
            </button>
            <div className="text-xs text-muted-foreground">
              {ledger.contracts.length} sözleşme · {ledger.movements.length} hareket · {c}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {ledger.hasKesinHesap && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 text-emerald-600 text-[10px] font-medium px-1.5 py-0.5">
                <CheckCircle2 className="h-3 w-3" />
                Kesin Hesap Yapıldı
              </span>
            )}
            {ledger.isOverPaid && (
              <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 text-destructive text-[10px] font-medium px-1.5 py-0.5">
                <AlertTriangle className="h-3 w-3" />
                Sözleşme Aşıldı
              </span>
            )}
            {ledger.remainingContract > 0.5 && ledger.contracts.length > 0 && (
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCloseRemaining}>
                <CircleDollarSign className="h-3.5 w-3.5 mr-1" />
                Kalanı Kapat
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Hareketler
            </Button>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs tabular-nums">
          <div className="space-y-1">
            <Row label="Sözleşme tutarı" excl={ledger.contractTotal} incl={ledger.contractTotalIncl} />
            <Row label="Toplam hakediş" excl={ledger.hakedisTotal} incl={ledger.hakedisTotalIncl} />
            <div className="pl-3 space-y-0.5 text-[11px] text-muted-foreground">
              <div className="flex justify-between">
                <span>· Ara hakediş</span>
                <span>{formatCurrencyWithType(ledger.araTotal, c)}</span>
              </div>
              <div className="flex justify-between">
                <span>· Alelhesap (mahsup edilecek)</span>
                <span className="text-amber-600">
                  {formatCurrencyWithType(ledger.alelhesapTotal, c)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>· Kesin hesap</span>
                <span>{formatCurrencyWithType(ledger.kesinHesapTotal, c)}</span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Row
              label="Onaylanan"
              excl={ledger.approvedTotal}
              incl={ledger.approvedTotalIncl}
              valueClass="text-emerald-600"
            />
            <Row
              label="Ödenen"
              excl={ledger.paidTotal}
              incl={ledger.paidTotalIncl}
              valueClass="text-primary"
            />
            <Row
              label="Onaylı ama ödenmemiş"
              excl={ledger.remainingApproved}
              incl={ledger.remainingApprovedIncl}
              valueClass={ledger.remainingApproved > 0 ? 'text-amber-600' : 'text-foreground'}
              bordered
            />
            <Row
              label="Sözleşmeye kalan"
              excl={ledger.remainingContract}
              incl={ledger.remainingContractIncl}
              valueClass={
                ledger.remainingContract < 0
                  ? 'text-destructive'
                  : ledger.remainingContract === 0
                  ? 'text-emerald-600'
                  : 'text-foreground'
              }
            />
          </div>
        </div>
      </div>

      {open && (
        <div className="border-t overflow-x-auto">
          {ledger.movements.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Hareket yok</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Tarih</TableHead>
                  <TableHead className="text-xs">No</TableHead>
                  <TableHead className="text-xs">Tip</TableHead>
                  <TableHead className="text-xs">Açıklama</TableHead>
                  <TableHead className="text-xs text-right">Tutar</TableHead>
                  <TableHead className="text-xs text-right">Ödenen</TableHead>
                  <TableHead className="text-xs text-right">Bakiye</TableHead>
                  <TableHead className="text-xs text-center">Detay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.movements.map((m: LedgerMovement) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(m.date)}</TableCell>
                    <TableCell className="text-xs font-medium whitespace-nowrap">
                      {m.no}
                      {!m.contractId && (
                        <span className="ml-1 text-[10px] text-muted-foreground">(Sözleşmesiz)</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          m.type === 'alelhesap'
                            ? 'bg-amber-500/10 text-amber-600'
                            : m.type === 'kesin_hesap'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {m.typeLabel}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs max-w-[240px] truncate" title={m.description}>
                      {m.description || '-'}
                      {m.offsetAmount ? (
                        <span className="block text-[10px] text-muted-foreground">
                          Mahsup: {formatCurrencyWithType(m.offsetAmount, c)}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      <span className="block font-medium">
                        {formatCurrencyWithType(m.amountIncl, c)}
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        Hariç: {formatCurrencyWithType(m.amount, c)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums text-primary">
                      {formatCurrencyWithType(m.paidIncl, c)}
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums font-medium">
                      {formatCurrencyWithType(m.runningBalanceIncl, c)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => onOpenHakedis(m.id)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}
