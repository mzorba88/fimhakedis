import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/MainLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useHakedisStore } from '@/store/hakedisStore';
import {
  formatCurrencyWithType,
  formatDate,
  contractTypeLabels,
  Currency,
  PaymentStatus,
  ApprovalStatus,
  paymentStatusLabels,
  workCategories,
} from '@/types/hakedis';
import { generateContractPDF, generateHakedisPDF, generateSubcontractorPDF } from '@/utils/pdfGenerator';
import {
  exportSingleContractToExcel,
  exportSingleHakedisToExcel,
  exportSubcontractorReportToExcel,
} from '@/utils/excelExport';
import { getSubcontractorProjectAccounts, type SubcontractorProjectAccount } from '@/utils/contractAccounting';
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

  // Totals by currency
  const totals = useMemo(() => {
    const contractByCur: Record<string, number> = {};
    const hakedisByCur: Record<string, number> = {};
    const paidByCur: Record<string, number> = {};
    subContracts.forEach(({ c }) => {
      contractByCur[c.currency] =
        (contractByCur[c.currency] || 0) + (c.totalAmount || 0);
    });
    subHakedisler.forEach((h) => {
      hakedisByCur[h.currency] =
        (hakedisByCur[h.currency] || 0) + (h.totalAmount || 0);
      paidByCur[h.currency] =
        (paidByCur[h.currency] || 0) + (h.paidAmount || 0);
    });
    return { contractByCur, hakedisByCur, paidByCur };
  }, [subContracts, subHakedisler]);

  // Proje bazlı cari hesap (her proje + para birimi için ayrı kart)
  const projectAccounts: SubcontractorProjectAccount[] = useMemo(() => {
    if (!selected) return [];
    return getSubcontractorProjectAccounts(
      selected,
      workEntries,
      subcontractorHakedisler,
      (id?: string) => projects.find((p) => p.id === id)?.projectName || 'Proje belirtilmemiş'
    );
  }, [selected, workEntries, subcontractorHakedisler, projects]);


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
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.projectName}
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
                          {workCategories.map((c) => (
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
                      />
                      <SummaryBox
                        icon={<FileText className="h-4 w-4" />}
                        title="Hakediş Toplamı"
                        amounts={totals.hakedisByCur}
                      />
                      <SummaryBox
                        icon={<Wallet className="h-4 w-4" />}
                        title="Ödenen"
                        amounts={totals.paidByCur}
                      />
                    </div>
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
                                  <TableCell className="text-right tabular-nums">
                                    {formatCurrencyWithType(c.totalAmount || 0, c.currency as Currency)}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums text-xs">
                                    <div>{formatCurrencyWithType(derived.hakedisTotal, c.currency as Currency)}</div>
                                    <div className="text-muted-foreground">{formatCurrencyWithType(derived.paid, c.currency as Currency)}</div>
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
                                    <TableCell className="text-right tabular-nums">
                                      {formatCurrencyWithType(h.totalAmount || 0, h.currency as Currency)}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                      {formatCurrencyWithType(h.paidAmount || 0, h.currency as Currency)}
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
}: {
  icon: React.ReactNode;
  title: string;
  amounts: Record<string, number>;
}) {
  const entries = Object.entries(amounts).filter(([, v]) => v > 0);
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <div className="mt-1.5 space-y-0.5">
        {entries.length === 0 ? (
          <div className="text-sm text-muted-foreground">—</div>
        ) : (
          entries.map(([cur, val]) => (
            <div key={cur} className="text-sm font-semibold tabular-nums">
              {formatCurrencyWithType(val, cur as Currency)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
