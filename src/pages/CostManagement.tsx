import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MainLayout } from '@/components/MainLayout';
import { ProjectCombobox } from '@/components/ProjectCombobox';
import { StatusBadge } from '@/components/StatusBadge';
import { useHakedisStore } from '@/store/hakedisStore';
import { buildProjectCost, UNCLASSIFIED, type Money, type SubcontractorRow } from '@/utils/projectCost';
import { formatCurrencyWithType, formatDate, hakedisTypeLabels, contractTypeLabels, type Currency } from '@/types/hakedis';
import { foldTr, cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, ChevronDown, ChevronRight, ArrowUpDown, ExternalLink } from 'lucide-react';

type VatMode = 'excl' | 'incl';
type SortKey = 'subcontractor' | 'contract' | 'approved' | 'paid' | 'remaining';

const fmt = (n: number, c: Currency) => formatCurrencyWithType(n || 0, c);

function Num({ value, currency, className }: { value: number; currency: Currency; className?: string }) {
  return <span className={cn('tabular-nums whitespace-nowrap', className)}>{fmt(value, currency)}</span>;
}

export default function CostManagement() {
  const { projects, workEntries, subcontractorHakedisler, subcontractors } = useHakedisStore();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => (a.projectCode || '').localeCompare(b.projectCode || '', 'tr', { numeric: true })),
    [projects]
  );
  const projectId = params.get('proje') || '';
  useEffect(() => {
    if (!projectId && sortedProjects.length) {
      const firstActive = sortedProjects.find((p) => p.status === 'aktif') || sortedProjects[0];
      setParams({ proje: firstActive.id }, { replace: true });
    }
  }, [projectId, sortedProjects, setParams]);

  const [vat, setVat] = useState<VatMode>('excl');
  const [cur, setCur] = useState<'all' | Currency>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'approved', dir: -1 });
  const [selected, setSelected] = useState<SubcontractorRow | null>(null);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [hkType, setHkType] = useState('all');
  const [hkApproval, setHkApproval] = useState('all');
  const [hkPayment, setHkPayment] = useState('all');

  const data = useMemo(
    () => (projectId ? buildProjectCost(projectId, subcontractorHakedisler, workEntries, subcontractors) : null),
    [projectId, subcontractorHakedisler, workEntries, subcontractors]
  );
  const v = (m: Money) => (vat === 'excl' ? m.excl : m.incl);
  const curOk = (c: Currency) => cur === 'all' || cur === c;
  const project = projects.find((p) => p.id === projectId);

  const subRows = useMemo(() => {
    if (!data) return [];
    const val = (r: SubcontractorRow) =>
      sort.key === 'subcontractor' ? r.subcontractor : v(r[sort.key]);
    return data.subcontractors
      .filter((r) => curOk(r.currency))
      .filter((r) => !q || foldTr(`${r.subcontractor} ${r.category}`).includes(foldTr(q)))
      .sort((a, b) => {
        const x = val(a), y = val(b);
        return (typeof x === 'string' ? x.localeCompare(y as string, 'tr') : (x as number) - (y as number)) * sort.dir;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, sort, cur, vat]);

  const hkRows = useMemo(() => {
    if (!data) return [];
    return data.hakedisler.filter((r) => {
      const h = r.hakedis;
      if (!curOk(h.currency)) return false;
      if (hkType === 'sozlesmesiz' ? !r.isContractless : hkType !== 'all' && (h.hakedisType || 'ara_hakedis') !== hkType) return false;
      if (hkApproval !== 'all' && h.approvalStatus !== hkApproval) return false;
      if (hkPayment !== 'all' && h.paymentStatus !== hkPayment) return false;
      if (q && !foldTr(`${h.subcontractor} ${h.hakedisNo} ${r.categoryLabel} ${h.description || ''}`).includes(foldTr(q))) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, q, cur, hkType, hkApproval, hkPayment]);

  const currenciesInProject = data?.currencies.map((c) => c.currency) || [];
  const SortHead = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={cn('px-3 py-2 font-medium', right ? 'text-right' : 'text-left')}>
      <button
        className="inline-flex items-center gap-1 hover:text-foreground"
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? ((-s.dir) as 1 | -1) : -1 }))}
      >
        {label} <ArrowUpDown className="h-3 w-3" />
      </button>
    </th>
  );
  const hakedisLink = (id: string) => `/hakedisler?view=${id}`;

  return (
    <MainLayout>
      <div className="space-y-5">
        {/* Başlık ve kontroller */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="page-title">Maliyet Yönetimi</h1>
            <p className="page-subtitle">Proje bazında anlaşma, hakediş, ödeme ve iş kalemi maliyetleri</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ProjectCombobox
              projects={sortedProjects}
              value={projectId}
              onChange={(id) => { setSelected(null); setParams({ proje: id }); }}
              placeholder="Proje seçin"
              className="w-72"
            />
            <Select value={cur} onValueChange={(x) => setCur(x as any)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm para b.</SelectItem>
                {currenciesInProject.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <ToggleGroup type="single" value={vat} onValueChange={(x) => x && setVat(x as VatMode)} variant="outline" size="sm">
              <ToggleGroupItem value="excl">KDV Hariç</ToggleGroupItem>
              <ToggleGroupItem value="incl">KDV Dahil</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {!data || !project ? (
          <div className="card-elevated p-10 text-center text-sm text-muted-foreground">Proje seçin</div>
        ) : (
          <>
            {/* Özet: para birimi başına bir satır */}
            <div className="card-elevated overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Para birimi</th>
                    <th className="px-3 py-2 text-right font-medium">Anlaşılan bedel</th>
                    <th className="px-3 py-2 text-right font-medium">Onaylı hakediş</th>
                    <th className="px-3 py-2 text-right font-medium">Kayıtlı ödeme</th>
                    <th className="px-3 py-2 text-right font-medium">Kalan ödeme</th>
                    <th className="px-3 py-2 text-right font-medium">Sözleşmeye kalan iş</th>
                    <th className="px-3 py-2 text-right font-medium">Onay bekleyen</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.currencies.filter((c) => curOk(c.currency)).map((c) => (
                    <tr key={c.currency}>
                      <td className="px-3 py-2 font-medium">{c.currency}</td>
                      <td className="px-3 py-2 text-right"><Num value={v(c.contract)} currency={c.currency} /></td>
                      <td className="px-3 py-2 text-right"><Num value={v(c.approved)} currency={c.currency} /></td>
                      <td className="px-3 py-2 text-right"><Num value={v(c.paid)} currency={c.currency} /></td>
                      <td className="px-3 py-2 text-right">
                        {c.fullyReliable ? (
                          <Num value={v(c.remaining)} currency={c.currency} className="font-semibold" />
                        ) : (
                          <div className="leading-tight">
                            <Num value={v(c.verified.remaining)} currency={c.currency} className="font-semibold" />
                            <div className="text-[11px] text-amber-700">doğrulanmış kısım · kesinleşmedi</div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right"><Num value={v(c.remainingContract)} currency={c.currency} /></td>
                      <td className="px-3 py-2 text-right text-muted-foreground"><Num value={c.pending} currency={c.currency} /></td>
                    </tr>
                  ))}
                  {data.currencies.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Bu projede kayıt yok</td></tr>
                  )}
                </tbody>
              </table>
              <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
                {vat === 'excl' ? 'Tutarlar KDV hariç.' : 'KDV dahil: her kaydın kendi KDV oranı kullanılır; oranı girilmemiş kayıtlara KDV eklenmez.'}{' '}
                Anlaşılan bedel yalnızca sözleşmelerden gelir; sözleşmesiz hakedişler onaylı hakedişe dahildir ama bedel oluşturmaz. Onay bekleyen tutar KDV hariçtir ve borç sayılmaz.
                {vat === 'incl' && data.recordsWithoutVatRate > 0 && ` (${data.recordsWithoutVatRate} kayıtta KDV oranı yok.)`}
              </p>
            </div>

            {/* İnceleme bekleyenler */}
            {(data.unresolved.length > 0 || data.unverifiedAlelhesap.length > 0) && (
              <Collapsible className="rounded-lg border border-amber-300 bg-amber-50 text-sm text-amber-900">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    İnceleme bekleyen finansal kayıtlar: {data.unresolved.length} belirsiz kesin hesap / ödeme
                    {data.unverifiedAlelhesap.length > 0 && `, ${data.unverifiedAlelhesap.length} niteliği doğrulanmamış alelhesap`}
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 border-t border-amber-200 px-3 py-2">
                  {data.unresolved.length > 0 && (
                    <div>
                      <p className="mb-1 font-medium">Belirsiz kayıtlar — bu dosyaların bakiyesi kesinleşmedi</p>
                      <ul className="space-y-1 text-xs">
                        {data.unresolved.map(({ hakedis, reasons }) => (
                          <li key={hakedis.id}>
                            <Link className="font-medium underline" to={hakedisLink(hakedis.id)}>{hakedis.hakedisNo}</Link>{' '}
                            {hakedis.subcontractor} · {fmt(hakedis.totalAmount, hakedis.currency)} — {reasons.join('; ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.unverifiedAlelhesap.length > 0 && (
                    <div>
                      <p className="mb-1 font-medium">Alelhesaplar — avans mı tahakkuk mu doğrulanmadı (şimdilik onaylı hakediş içinde sayılıyor)</p>
                      <ul className="space-y-1 text-xs">
                        {data.unverifiedAlelhesap.map((h) => (
                          <li key={h.id}>
                            <Link className="font-medium underline" to={hakedisLink(h.id)}>{h.hakedisNo}</Link>{' '}
                            {h.subcontractor} · {fmt(h.totalAmount, h.currency)} · ödenen {fmt(h.paidAmount || 0, h.currency)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Link to="/cari-dogrulama" className="inline-block text-xs font-medium underline">Cari Hesap Doğrulama sayfasını aç</Link>
                </CollapsibleContent>
              </Collapsible>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input placeholder="Altyüklenici, hakediş no veya iş kalemi ara..." value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-sm" />
            </div>

            <Tabs defaultValue="subs">
              <TabsList>
                <TabsTrigger value="subs">Altyükleniciler ({subRows.length})</TabsTrigger>
                <TabsTrigger value="cats">İş Kalemleri</TabsTrigger>
                <TabsTrigger value="hks">Hakedişler ({hkRows.length})</TabsTrigger>
              </TabsList>

              {/* Altyükleniciler */}
              <TabsContent value="subs">
                <div className="card-elevated overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <SortHead k="subcontractor" label="Altyüklenici" />
                        <th className="hidden px-3 py-2 text-left font-medium md:table-cell">İş kategorisi</th>
                        <SortHead k="contract" label="Anlaşılan" right />
                        <SortHead k="approved" label="Onaylı hakediş" right />
                        <SortHead k="paid" label="Kayıtlı ödeme" right />
                        <SortHead k="remaining" label="Kalan ödeme" right />
                        <th className="hidden px-3 py-2 text-right font-medium lg:table-cell">Sözleşmeye kalan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {subRows.map((r) => (
                        <tr key={r.key} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelected(r)}>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 font-medium">
                              {r.subcontractor}
                              <Badge variant="outline" className="text-[10px]">{r.currency}</Badge>
                              {!r.reliable && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-label="İnceleme gerekli" />}
                              {r.unresolvedAlelhesap.length > 0 && r.reliable && (
                                <span className="text-[10px] text-amber-700">alelhesap doğrulanmadı</span>
                              )}
                            </div>
                          </td>
                          <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">{r.category || '—'}</td>
                          <td className="px-3 py-2 text-right">{r.contract.excl > 0 ? <Num value={v(r.contract)} currency={r.currency} /> : <span className="text-muted-foreground">Sözleşmesiz</span>}</td>
                          <td className="px-3 py-2 text-right"><Num value={v(r.approved)} currency={r.currency} /></td>
                          <td className="px-3 py-2 text-right"><Num value={v(r.paid)} currency={r.currency} /></td>
                          <td className="px-3 py-2 text-right font-medium">
                            {!r.reliable ? (
                              <span className="text-amber-700">Kesin değil</span>
                            ) : r.file.overpayment > 0 ? (
                              <span className="text-destructive" title="Fazla Ödeme / Devreden Avans">Fazla öd. <Num value={-v(r.remaining)} currency={r.currency} /></span>
                            ) : (
                              <Num value={v(r.remaining)} currency={r.currency} className={r.remaining.excl > 0.01 ? 'text-amber-700' : ''} />
                            )}
                          </td>
                          <td className="hidden px-3 py-2 text-right lg:table-cell">{r.contract.excl > 0 ? <Num value={v(r.remainingContract)} currency={r.currency} /> : '—'}</td>
                        </tr>
                      ))}
                      {subRows.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Kayıt yok</td></tr>}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              {/* İş Kalemleri */}
              <TabsContent value="cats">
                <div className="card-elevated overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">İş kalemi</th>
                        <th className="px-3 py-2 text-right font-medium">Taahhüt (sözleşme)</th>
                        <th className="px-3 py-2 text-right font-medium">Onaylı maliyet</th>
                        <th className="px-3 py-2 text-right font-medium">Kayıtlı ödeme</th>
                        <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Bütçe</th>
                        <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Sapma</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.categories.filter((c) => curOk(c.currency)).filter((c) => !q || foldTr(c.category + c.subcontractors.join(' ')).includes(foldTr(q))).map((c) => {
                        const open = openCat === c.key;
                        return (
                          <Fragment key={c.key}>
                            <tr className="cursor-pointer hover:bg-muted/30" onClick={() => setOpenCat(open ? null : c.key)}>
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5 font-medium">
                                  {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                  <span className={c.category === UNCLASSIFIED ? 'text-amber-700' : ''}>{c.category}</span>
                                  <Badge variant="outline" className="text-[10px]">{c.currency}</Badge>
                                  <span className="text-xs font-normal text-muted-foreground">{c.subcontractors.length} altyüklenici</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right">{c.committed.excl > 0 ? <Num value={v(c.committed)} currency={c.currency} /> : '—'}</td>
                              <td className="px-3 py-2 text-right"><Num value={v(c.approved)} currency={c.currency} /></td>
                              <td className="px-3 py-2 text-right"><Num value={v(c.paid)} currency={c.currency} /></td>
                              <td className="hidden px-3 py-2 text-right text-xs text-muted-foreground md:table-cell">{c.budget ? <Num value={v(c.budget)} currency={c.currency} /> : 'Bütçe tanımlanmadı'}</td>
                              <td className="hidden px-3 py-2 text-right text-xs text-muted-foreground md:table-cell">{c.budget ? <Num value={v(c.budget) - v(c.approved)} currency={c.currency} /> : '—'}</td>
                            </tr>
                            {open && (
                              <tr className="bg-muted/20">
                                <td colSpan={6} className="px-6 py-2">
                                  <table className="w-full text-xs">
                                    <tbody className="divide-y">
                                      {data.hakedisler.filter((r) => c.hakedisIds.includes(r.hakedis.id)).map((r) => (
                                        <tr key={r.hakedis.id}>
                                          <td className="py-1"><Link className="text-primary hover:underline" to={hakedisLink(r.hakedis.id)}>{r.hakedis.hakedisNo}</Link></td>
                                          <td className="py-1">{r.hakedis.subcontractor}</td>
                                          <td className="py-1 text-muted-foreground">{formatDate(r.hakedis.date)}</td>
                                          <td className="py-1 text-muted-foreground">{r.categoryLabel !== c.category ? `${r.categoryLabel} (dağıtıldı)` : ''}</td>
                                          <td className="py-1 text-right">{r.period != null ? <Num value={r.period} currency={r.hakedis.currency} /> : 'belirsiz'}</td>
                                        </tr>
                                      ))}
                                      {c.hakedisIds.length === 0 && <tr><td className="py-1 text-muted-foreground">Onaylı hakediş yok — yalnızca taahhüt: {c.subcontractors.join(', ')}</td></tr>}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">
                    Birden fazla kalemli hakedişler kalem tutarlarına göre dağıtılır. Kategorisi güvenilir belirlenemeyen tutarlar "Sınıflandırılmamış" altında gösterilir. Onaylı maliyet tablosunda yalnızca onaylı hakedişler var; esası belirsiz kesin hesaplar dahil değil.
                  </p>
                </div>
              </TabsContent>

              {/* Hakedişler */}
              <TabsContent value="hks" className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Select value={hkType} onValueChange={setHkType}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm tipler</SelectItem>
                      <SelectItem value="ara_hakedis">Ara Hakediş</SelectItem>
                      <SelectItem value="alelhesap">Alelhesap</SelectItem>
                      <SelectItem value="kesin_hesap">Kesin Hesap</SelectItem>
                      <SelectItem value="sozlesmesiz">Sözleşmesiz</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={hkApproval} onValueChange={setHkApproval}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm onaylar</SelectItem>
                      <SelectItem value="onaylandi">Onaylandı</SelectItem>
                      <SelectItem value="onay_bekliyor">Onay Bekliyor</SelectItem>
                      <SelectItem value="revize">Revize</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={hkPayment} onValueChange={setHkPayment}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tüm ödemeler</SelectItem>
                      <SelectItem value="odendi">Ödendi</SelectItem>
                      <SelectItem value="kismen_odendi">Kısmen Ödendi</SelectItem>
                      <SelectItem value="odenmedi">Ödenmedi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="card-elevated overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Hakediş No</th>
                        <th className="px-3 py-2 text-left font-medium">Altyüklenici</th>
                        <th className="px-3 py-2 text-left font-medium">Tip</th>
                        <th className="hidden px-3 py-2 text-left font-medium md:table-cell">Tarih</th>
                        <th className="hidden px-3 py-2 text-left font-medium lg:table-cell">İş kategorisi</th>
                        <th className="px-3 py-2 text-right font-medium">Dönem tutarı</th>
                        <th className="px-3 py-2 text-center font-medium">Onay</th>
                        <th className="px-3 py-2 text-center font-medium">Ödeme</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {hkRows.map((r) => {
                        const h = r.hakedis;
                        const rate = h.vatRate && h.vatRate > 0 ? h.vatRate : 0;
                        return (
                          <tr key={h.id} className="cursor-pointer hover:bg-muted/30" onClick={() => navigate(hakedisLink(h.id))}>
                            <td className="px-3 py-2 font-medium text-primary">{h.hakedisNo}</td>
                            <td className="px-3 py-2">{h.subcontractor}</td>
                            <td className="px-3 py-2 text-xs">
                              {hakedisTypeLabels[h.hakedisType || 'ara_hakedis']}
                              {r.isContractless && <span className="ml-1 text-muted-foreground">· Sözleşmesiz</span>}
                              {r.breakdown.basis === 'belirsiz' && <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-600" />}
                            </td>
                            <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">{formatDate(h.date)}</td>
                            <td className={cn('hidden px-3 py-2 lg:table-cell', r.categoryLabel === UNCLASSIFIED && 'text-amber-700')}>{r.categoryLabel}</td>
                            <td className="px-3 py-2 text-right" title={r.period != null ? `Matrah ${fmt(r.period, h.currency)} · KDV %${rate} ${fmt(r.period * rate / 100, h.currency)} · KDV dahil ${fmt(r.period * (1 + rate / 100), h.currency)}` : undefined}>
                              {r.period == null ? (
                                <span className="text-xs text-amber-700">Belirsiz ({fmt(h.totalAmount, h.currency)} girilmiş)</span>
                              ) : (
                                <Num value={vat === 'excl' ? r.period : r.period * (1 + rate / 100)} currency={h.currency} />
                              )}
                            </td>
                            <td className="px-3 py-2 text-center"><StatusBadge status={h.approvalStatus} size="sm" /></td>
                            <td className="px-3 py-2 text-center"><StatusBadge status={h.paymentStatus} size="sm" /></td>
                          </tr>
                        );
                      })}
                      {hkRows.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Kayıt yok</td></tr>}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Altyüklenici detay paneli */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.subcontractor} <span className="text-sm font-normal text-muted-foreground">· {selected.currency}</span></SheetTitle>
                <SheetDescription>{project?.projectCode} — {project?.projectName}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                {!selected.reliable && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                    Bakiye kesinleşmedi: {selected.file.unresolved.map((u) => `${u.hakedisNo} (${u.reasons.join('; ') || 'esas belirsiz'})`).join(' · ')}
                  </div>
                )}
                {selected.unresolvedAlelhesap.length > 0 && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                    Niteliği doğrulanmamış alelhesap: {selected.unresolvedAlelhesap.map((a) => a.hakedisNo).join(', ')}
                  </div>
                )}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {[
                    ['Anlaşılan bedel', selected.contract],
                    ['Onaylı hakediş', selected.approved],
                    ['Kayıtlı ödeme', selected.paid],
                  ].map(([l, m]) => (
                    <Fragment key={l as string}>
                      <dt className="text-muted-foreground">{l as string}</dt>
                      <dd className="text-right"><Num value={v(m as Money)} currency={selected.currency} /></dd>
                    </Fragment>
                  ))}
                  {selected.file.advancePayments > 0 && (
                    <><dt className="pl-3 text-xs text-muted-foreground">· avans (alelhesap)</dt><dd className="text-right text-xs"><Num value={selected.file.advancePayments} currency={selected.currency} /></dd></>
                  )}
                  <dt className="border-t pt-1 font-medium">{selected.file.overpayment > 0 ? 'Fazla Ödeme / Devreden Avans' : 'Ödenecek bakiye'}</dt>
                  <dd className="border-t pt-1 text-right font-semibold">
                    {selected.reliable ? <Num value={Math.abs(v(selected.remaining))} currency={selected.currency} /> : <span className="text-amber-700">Kesin değil</span>}
                  </dd>
                  {selected.contract.excl > 0 && (
                    <><dt className="text-muted-foreground">Sözleşmeye kalan iş</dt><dd className="text-right"><Num value={v(selected.remainingContract)} currency={selected.currency} /></dd></>
                  )}
                </dl>

                <Section title={`Anlaşmalar (${selected.contracts.length})`} defaultOpen={selected.contracts.length > 0}>
                  {selected.contracts.length === 0 ? <p className="text-xs text-muted-foreground">Sözleşme yok — sözleşmesiz hakedişler</p> : (
                    <ul className="divide-y text-xs">
                      {selected.contracts.map((c) => (
                        <li key={c.id} className="flex items-center justify-between gap-2 py-1.5">
                          <Link to={`/yapilanisler?view=${c.id}`} className="text-primary hover:underline">{c.contractNo}</Link>
                          <span className="text-muted-foreground">{contractTypeLabels[c.contractType]} · {c.workCategory}</span>
                          <Num value={vat === 'excl' ? c.totalAmount : c.totalAmount * (1 + (c.vatRate || 0) / 100)} currency={c.currency} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                {(['ara_hakedis', 'alelhesap', 'kesin_hesap'] as const).map((t) => {
                  const list = selected.hakedisler.filter((h) => (h.hakedisType || 'ara_hakedis') === t);
                  if (!list.length) return null;
                  return (
                    <Section key={t} title={`${hakedisTypeLabels[t]} (${list.length})`} defaultOpen={t !== 'ara_hakedis' || list.length <= 6}>
                      <ul className="divide-y text-xs">
                        {list.map((h) => {
                          const b = data?.hakedisler.find((r) => r.hakedis.id === h.id);
                          return (
                            <li key={h.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 py-1.5">
                              <span>
                                <Link to={hakedisLink(h.id)} className="text-primary hover:underline">{h.hakedisNo}</Link>
                                <span className="ml-1 text-muted-foreground">{formatDate(h.date)}{!h.contractId && ' · Sözleşmesiz'}</span>
                              </span>
                              <span className="text-right">
                                {b?.period != null ? <Num value={b.period} currency={h.currency} /> : <span className="text-amber-700">belirsiz</span>}
                                <span className="block text-[10px] text-muted-foreground">ödenen {fmt(h.paidAmount || 0, h.currency)}</span>
                              </span>
                              <StatusBadge status={h.approvalStatus} size="sm" />
                            </li>
                          );
                        })}
                      </ul>
                    </Section>
                  );
                })}

                <Section title="Kategorilere dağılım (onaylı, KDV hariç)" defaultOpen={false}>
                  {selected.categories.length === 0 ? <p className="text-xs text-muted-foreground">Onaylı hakediş yok</p> : (
                    <ul className="text-xs">
                      {selected.categories.map((c) => (
                        <li key={c.category} className="flex justify-between py-0.5">
                          <span className={c.category === UNCLASSIFIED ? 'text-amber-700' : ''}>{c.category}</span>
                          <Num value={c.approved} currency={selected.currency} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>

                <Link to={`/altyukleniciler?name=${encodeURIComponent(selected.subcontractor)}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  Altyüklenici cari hesabını aç <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </MainLayout>
  );
}

function Section({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium hover:bg-muted/30">
        {title}
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t px-3 py-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}
