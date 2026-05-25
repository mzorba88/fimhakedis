import { useMemo, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { StatusBadge } from '@/components/StatusBadge';
import { useHakedisStore } from '@/store/hakedisStore';
import {
  formatCurrencyWithType,
  formatDate,
  contractTypeLabels,
  Currency,
  PaymentStatus,
  paymentStatusLabels,
  workCategories,
} from '@/types/hakedis';
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
import { Search, Users, FileText, Wallet, ClipboardList } from 'lucide-react';

export default function Subcontractors() {
  const { subcontractors, workEntries, subcontractorHakedisler, projects } =
    useHakedisStore();

  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [itemSearch, setItemSearch] = useState('');

  // Compute subcontractor list with stats (only those that have records)
  const subcontractorStats = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        contracts: number;
        hakedisler: number;
        categories: Set<string>;
      }
    >();

    const ensure = (name: string) => {
      if (!map.has(name)) {
        map.set(name, {
          name,
          contracts: 0,
          hakedisler: 0,
          categories: new Set(),
        });
      }
      return map.get(name)!;
    };

    workEntries.forEach((c) => {
      const s = ensure(c.subcontractor);
      s.contracts += 1;
      if (c.workCategory) s.categories.add(c.workCategory);
    });
    subcontractorHakedisler.forEach((h) => {
      const s = ensure(h.subcontractor);
      s.hakedisler += 1;
    });

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

  const subContracts = useMemo(() => {
    if (!selected) return [];
    return workEntries
      .filter((c) => c.subcontractor === selected)
      .filter((c) => projectFilter === 'all' || c.projectId === projectFilter)
      .filter(
        (c) => categoryFilter === 'all' || c.workCategory === categoryFilter
      )
      .filter(
        (c) => paymentFilter === 'all' || c.paymentStatus === paymentFilter
      )
      .filter((c) => {
        const term = itemSearch.trim().toLocaleLowerCase('tr');
        if (!term) return true;
        return (
          (c.contractNo || '').toLocaleLowerCase('tr').includes(term) ||
          (c.description || '').toLocaleLowerCase('tr').includes(term) ||
          (c.workCategory || '').toLocaleLowerCase('tr').includes(term)
        );
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [
    selected,
    workEntries,
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
      .filter(
        (h) => paymentFilter === 'all' || h.paymentStatus === paymentFilter
      )
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

  // Totals by currency for the selected subcontractor (after filters)
  const totals = useMemo(() => {
    const contractByCur: Record<string, number> = {};
    const hakedisByCur: Record<string, number> = {};
    const paidByCur: Record<string, number> = {};
    subContracts.forEach((c) => {
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

  const resetFilters = () => {
    setProjectFilter('all');
    setCategoryFilter('all');
    setPaymentFilter('all');
    setItemSearch('');
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
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{selected}</CardTitle>
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
                      <CardContent className="p-0">
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
                                <TableHead className="text-right">Tutar</TableHead>
                                <TableHead>Onay</TableHead>
                                <TableHead>Ödeme</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {subContracts.map((c) => (
                                <TableRow key={c.id}>
                                  <TableCell className="font-medium">{c.contractNo}</TableCell>
                                  <TableCell>{formatDate(c.date)}</TableCell>
                                  <TableCell>{projectName(c.projectId)}</TableCell>
                                  <TableCell>{c.workCategory}</TableCell>
                                  <TableCell>{contractTypeLabels[c.contractType]}</TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {formatCurrencyWithType(c.totalAmount || 0, c.currency as Currency)}
                                  </TableCell>
                                  <TableCell><StatusBadge status={c.approvalStatus} size="sm" /></TableCell>
                                  <TableCell><StatusBadge status={c.paymentStatus} size="sm" /></TableCell>
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
                      <CardContent className="p-0">
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
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {subHakedisler.map((h) => (
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
                                </TableRow>
                              ))}
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
