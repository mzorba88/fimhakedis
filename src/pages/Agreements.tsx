import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MainLayout } from '@/components/MainLayout';
import { useHakedisStore } from '@/store/hakedisStore';
import { useWorkCategories } from '@/hooks/useWorkCategories';
import { ProjectCombobox } from '@/components/ProjectCombobox';
import { SubcontractorCombobox } from '@/components/SubcontractorCombobox';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Plus, Search, Trash2, Lightbulb, X, Pencil, Ruler, Package } from 'lucide-react';
import { toast } from 'sonner';
import { cn, foldTr, sortNatural } from '@/lib/utils';
import {
  Currency, WorkEntry, contractTypeLabels, currencySymbols, formatCurrencyWithType, formatDate,
} from '@/types/hakedis';
import {
  EnteredBasis, PlanRowInput, UnitPriceRowInput, agreementValueStatus, buildLumpSumAgreement,
  buildUnitPriceAgreement, checkPaymentPlan, readPriceBasis, toNet, vatBreakdown,
} from '@/utils/agreements';
import { collectPriceObservations, suggestUnitPrice, PriceObservation } from '@/utils/priceMemory';

const CURRENCIES: Currency[] = ['TRY', 'GBP', 'USD', 'EUR'];
const parseNum = (s: string) => {
  const t = (s || '').replace(/\s/g, '').replace(/\./g, (m, i, str) => (str.includes(',') ? '' : m)).replace(',', '.');
  const n = parseFloat(t);
  return isFinite(n) ? n : NaN;
};
const noWheel = { onWheel: (e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur() };

interface Row { id: string; description: string; workCategory: string; unit: string; price: string; qty: string; source?: string }
interface PRow { id: string; name: string; mode: 'yuzde' | 'tutar'; value: string; dueDate: string; note: string }
const newRow = (): Row => ({ id: `r${Math.random().toString(36).slice(2)}`, description: '', workCategory: '', unit: '', price: '', qty: '' });
const newPRow = (name = '', value = ''): PRow => ({ id: `p${Math.random().toString(36).slice(2)}`, name, mode: 'yuzde', value, dueDate: '', note: '' });

export default function Agreements() {
  const { projects, workEntries, subcontractorHakedisler, subcontractors, addSubcontractor, addWorkEntry, getNextContractNo, currentUser } = useHakedisStore();
  const { categories } = useWorkCategories();
  const projectName = (id: string) => projects.find((p) => p.id === id)?.projectCode || '—';

  const [q, setQ] = useState('');
  const [fProject, setFProject] = useState('all');
  const [fType, setFType] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = workEntries.find((w) => w.id === selectedId) || null;

  const list = useMemo(() => {
    const f = foldTr(q);
    return workEntries
      .filter((w) => fProject === 'all' || w.projectId === fProject)
      .filter((w) => fType === 'all' || w.contractType === fType)
      .filter((w) => !f || [w.contractNo, w.subcontractor, w.workCategory, projectName(w.projectId)].some((x) => foldTr(x).includes(f)))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workEntries, q, fProject, fType, projects]);

  // ---------- Form ----------
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [sub, setSub] = useState('');
  const [subIsNew, setSubIsNew] = useState(false);
  const [type, setType] = useState<'birim_fiyat' | 'goturu_bedel'>('birim_fiyat');
  const [currency, setCurrency] = useState<Currency>('GBP');
  const [vatRate, setVatRate] = useState('20');
  const [basis, setBasis] = useState<EnteredBasis>('kdv_haric');
  const [desc, setDesc] = useState('');
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [lumpTotal, setLumpTotal] = useState('');
  const [lumpCategory, setLumpCategory] = useState('');
  const [plan, setPlan] = useState<PRow[]>([]);
  const [planComplete, setPlanComplete] = useState(false);

  const reset = () => {
    setProjectId(''); setSub(''); setSubIsNew(false); setType('birim_fiyat'); setCurrency('GBP'); setVatRate('20');
    setBasis('kdv_haric'); setDesc(''); setRows([newRow()]); setLumpTotal(''); setLumpCategory(''); setPlan([]); setPlanComplete(false);
  };

  const observations = useMemo(() => collectPriceObservations(workEntries, subcontractorHakedisler), [workEntries, subcontractorHakedisler]);
  const vr = vatRate === '' ? undefined : parseNum(vatRate);
  const safeNet = (n: number) => { try { return toNet(n, basis, vr); } catch { return NaN; } };

  // Birim fiyat özet
  const unitSummary = useMemo(() => {
    let known = 0; let missing = 0; let filled = 0;
    rows.forEach((r) => {
      if (!r.description.trim()) return;
      filled++;
      const p = safeNet(parseNum(r.price)); const qn = parseNum(r.qty);
      if (isFinite(qn) && qn > 0 && isFinite(p)) known += p * qn; else missing++;
    });
    return { known, missing, filled };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, basis, vatRate]);

  const lumpNet = safeNet(parseNum(lumpTotal));
  const planAmounts = plan.filter((p) => p.name.trim()).map((p) => {
    const v = parseNum(p.value);
    if (!isFinite(v)) return { amount: 0 };
    return { amount: p.mode === 'yuzde' ? ((isFinite(lumpNet) ? lumpNet : 0) * v) / 100 : safeNet(v) || 0 };
  });
  const planCheck = isFinite(lumpNet) && lumpNet > 0 ? checkPaymentPlan(lumpNet, planAmounts, planComplete) : null;

  const updRow = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const updPRow = (id: string, patch: Partial<PRow>) => setPlan((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!projectId) return toast.error('Proje seçin');
    if (!sub.trim()) return toast.error('Altyüklenici seçin');
    if (basis === 'kdv_dahil' && !(vr && vr > 0)) return toast.error('KDV dahil fiyat için KDV oranı girin');
    setSaving(true);
    try {
      const header = {
        projectId, subcontractor: sub.trim(), currency, vatRate: vr != null && isFinite(vr) ? vr : undefined, priceBasis: basis,
        description: desc, date: new Date().toISOString().split('T')[0], contractNo: '', createdBy: currentUser.id,
      };
      // Önce doğrula (numara almadan), sonra numara al
      let payload;
      if (type === 'birim_fiyat') {
        const input: UnitPriceRowInput[] = rows.map((r) => ({
          id: r.id, description: r.description, workCategory: r.workCategory, unit: r.unit,
          unitPrice: parseNum(r.price), estimatedQuantity: r.qty.trim() ? parseNum(r.qty) : null, priceSource: r.source,
        }));
        payload = buildUnitPriceAgreement(header, input).payload;
      } else {
        const input: PlanRowInput[] = plan.map((p) => ({
          id: p.id, name: p.name, mode: p.mode,
          percentage: p.mode === 'yuzde' ? parseNum(p.value) : undefined,
          amount: p.mode === 'tutar' ? parseNum(p.value) : undefined, dueDate: p.dueDate, note: p.note,
        }));
        payload = buildLumpSumAgreement(header, { totalAmount: parseNum(lumpTotal), workCategory: lumpCategory, plan: input, planComplete }).payload;
      }
      if (subIsNew) await addSubcontractor(sub.trim(), payload.workCategory);
      const contractNo = await getNextContractNo();
      const created = await addWorkEntry({ ...payload, contractNo });
      toast.success(`İş anlaşması oluşturuldu: ${contractNo}`);
      setOpen(false); reset(); setSelectedId(created.id);
    } catch (e: any) {
      toast.error(e?.message || 'Kaydedilemedi');
    } finally { setSaving(false); }
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">İş Anlaşmaları</h1>
            <p className="page-subtitle">Birim fiyatlı ve götürü bedelli anlaşmalar · fiyat listeleri · ödeme planları</p>
          </div>
          <Button onClick={() => { reset(); setOpen(true); }} className="gap-2"><Plus className="h-4 w-4" />Yeni Anlaşma</Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="No, altyüklenici, kategori, proje ara..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <ProjectCombobox projects={sortNatural(projects, (p) => p.projectCode)} value={fProject} onChange={setFProject} includeAll allLabel="Tüm projeler" className="sm:w-56" />
          <Select value={fType} onValueChange={setFType}>
            <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm türler</SelectItem>
              <SelectItem value="birim_fiyat">Birim Fiyatlı</SelectItem>
              <SelectItem value="goturu_bedel">Götürü Bedelli</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="card-elevated overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">No</th>
                  <th className="px-3 py-2 text-left font-medium">Proje</th>
                  <th className="px-3 py-2 text-left font-medium">Altyüklenici</th>
                  <th className="hidden px-3 py-2 text-left font-medium md:table-cell">Tür</th>
                  <th className="px-3 py-2 text-right font-medium">Bedel (KDV hariç)</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {list.map((w) => {
                  const st = agreementValueStatus(w);
                  return (
                    <tr key={w.id} onClick={() => setSelectedId(w.id)} className={cn('cursor-pointer hover:bg-muted/30', selectedId === w.id && 'bg-primary/5')}>
                      <td className="px-3 py-2 font-mono text-xs">{w.contractNo}</td>
                      <td className="px-3 py-2">{projectName(w.projectId)}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{w.subcontractor}</div>
                        <div className="text-xs text-muted-foreground">{w.workCategory}</div>
                      </td>
                      <td className="hidden px-3 py-2 md:table-cell">
                        <Badge variant="outline" className="gap-1 text-[11px]">
                          {w.contractType === 'birim_fiyat' ? <Ruler className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                          {contractTypeLabels[w.contractType]}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {st === 'bedel_yok' ? <span className="text-muted-foreground">Bedel girilmemiş</span> : formatCurrencyWithType(w.totalAmount, w.currency)}
                        {st === 'tahmini_eksik' && <div className="text-[10px] text-amber-700">tahmini · miktarı eksik kalem var</div>}
                      </td>
                    </tr>
                  );
                })}
                {!list.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Kayıt yok</td></tr>}
              </tbody>
            </table>
          </div>

          <aside className="card-elevated h-fit p-4 lg:sticky lg:top-20">
            {selected ? <Detail c={selected} projectName={projectName} hakedisCount={subcontractorHakedisler.filter((h) => h.contractId === selected.id).length} onClose={() => setSelectedId(null)} />
              : <p className="py-10 text-center text-sm text-muted-foreground">Ayrıntıları görmek için bir anlaşma seçin</p>}
          </aside>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!o) setOpen(false); }}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Yeni İş Anlaşması</DialogTitle>
            <DialogDescription>Ticari fiyat anlaşması. Yazılı sözleşme belgesi ayrıca "Altyüklenici Sözleşmeleri" ekranında eklenebilir.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1"><Label>Proje *</Label>
              <ProjectCombobox projects={sortNatural(projects.filter((p) => p.status === 'aktif'), (p) => p.projectCode)} value={projectId} onChange={setProjectId} placeholder="Proje seçin" />
            </div>
            <div className="space-y-1"><Label>Altyüklenici *</Label>
              <SubcontractorCombobox names={subcontractors.map((s) => s.name)} value={sub} onChange={(v, isNew) => { setSub(v); setSubIsNew(isNew); }} placeholder="Altyüklenici seçin" />
            </div>
          </div>

          <ToggleGroup type="single" value={type} onValueChange={(v) => v && setType(v as any)} className="grid grid-cols-2 gap-2">
            <ToggleGroupItem value="birim_fiyat" className="h-auto flex-col items-start gap-0.5 border p-3 text-left data-[state=on]:border-primary data-[state=on]:bg-primary/5">
              <span className="flex items-center gap-1.5 font-medium"><Ruler className="h-4 w-4" />Birim Fiyatlı İş</span>
              <span className="text-xs font-normal text-muted-foreground">Kalem bazında fiyat listesi; miktar opsiyonel</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="goturu_bedel" className="h-auto flex-col items-start gap-0.5 border p-3 text-left data-[state=on]:border-primary data-[state=on]:bg-primary/5">
              <span className="flex items-center gap-1.5 font-medium"><Package className="h-4 w-4" />Götürü Bedelli İş</span>
              <span className="text-xs font-normal text-muted-foreground">Toplam bedel + opsiyonel ödeme aşamaları</span>
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1"><Label>Para birimi</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{currencySymbols[c]} {c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>KDV %</Label>
              <Input className="w-20" inputMode="decimal" value={vatRate} onChange={(e) => setVatRate(e.target.value)} {...noWheel} />
            </div>
            <div className="space-y-1"><Label>Fiyat esası</Label>
              <ToggleGroup type="single" variant="outline" size="sm" value={basis} onValueChange={(v) => v && setBasis(v as EnteredBasis)}>
                <ToggleGroupItem value="kdv_haric">KDV Hariç</ToggleGroupItem>
                <ToggleGroupItem value="kdv_dahil">KDV Dahil</ToggleGroupItem>
              </ToggleGroup>
            </div>
            {basis === 'kdv_dahil' && <p className="pb-1 text-xs text-muted-foreground">Fiyatlar KDV hariçe çevrilerek saklanır; girdiğiniz fiyat ve esas da kayda yazılır.</p>}
          </div>

          {type === 'birim_fiyat' ? (
            <div className="space-y-2">
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">İş kalemi açıklaması</th>
                      <th className="px-2 py-1.5 text-left font-medium">Kategori</th>
                      <th className="w-20 px-2 py-1.5 text-left font-medium">Birim</th>
                      <th className="w-32 px-2 py-1.5 text-right font-medium">Birim fiyat ({currencySymbols[currency]})</th>
                      <th className="w-24 px-2 py-1.5 text-right font-medium">Tahmini miktar</th>
                      <th className="w-32 px-2 py-1.5 text-right font-medium">Tahmini tutar</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r, idx) => {
                      const p = parseNum(r.price); const qn = parseNum(r.qty);
                      const amt = isFinite(p) && isFinite(qn) && qn > 0 ? p * qn : null;
                      return (
                        <tr key={r.id}>
                          <td className="p-1"><Input className="h-8" value={r.description} placeholder="örn. Seramik 60x60 işçilik" onChange={(e) => updRow(r.id, { description: e.target.value, source: undefined })} /></td>
                          <td className="p-1">
                            <Select value={r.workCategory || undefined} onValueChange={(v) => updRow(r.id, { workCategory: v })}>
                              <SelectTrigger className="h-8 min-w-36"><SelectValue placeholder="Seç" /></SelectTrigger>
                              <SelectContent className="max-h-72">{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          <td className="p-1"><Input className="h-8" value={r.unit} placeholder="m²" onChange={(e) => updRow(r.id, { unit: e.target.value, source: undefined })} /></td>
                          <td className="p-1">
                            <div className="flex items-center gap-1">
                              <Input className="h-8 text-right" inputMode="decimal" value={r.price} onChange={(e) => updRow(r.id, { price: e.target.value, source: undefined })} {...noWheel} />
                              <SuggestButton
                                query={{ subcontractor: sub, projectId, description: r.description, unit: r.unit, currency }}
                                observations={observations} projectName={projectName}
                                onPick={(o) => updRow(r.id, { price: String(basis === 'kdv_dahil' && vr ? Math.round(o.unitPrice * (1 + vr / 100) * 100) / 100 : o.unitPrice), source: `${o.sourceNo} · ${projectName(o.projectId)} · ${formatDate(o.date)}` })}
                              />
                            </div>
                            {r.source && <div className="mt-0.5 truncate text-[10px] text-muted-foreground" title={r.source}>Kaynak: {r.source}</div>}
                          </td>
                          <td className="p-1"><Input className="h-8 text-right" inputMode="decimal" placeholder="—" value={r.qty} onChange={(e) => updRow(r.id, { qty: e.target.value })} {...noWheel}
                            onKeyDown={(e) => { if (e.key === 'Enter' && idx === rows.length - 1) { e.preventDefault(); setRows((rs) => [...rs, newRow()]); } }} /></td>
                          <td className="px-2 text-right tabular-nums text-muted-foreground">{amt != null ? formatCurrencyWithType(amt, currency) : <span className="text-xs">miktar yok</span>}</td>
                          <td className="p-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.id !== r.id) : [newRow()]))}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setRows((rs) => [...rs, newRow()])}><Plus className="h-3.5 w-3.5" />Satır ekle</Button>
                <div className="text-right text-sm">
                  {unitSummary.filled > 0 && (
                    <TotalsLine net={unitSummary.known} vatRate={vr} currency={currency} label={unitSummary.missing ? 'Tahmini (eksik)' : 'Tahmini toplam'} />
                  )}
                  {unitSummary.missing > 0 && <p className="text-xs text-amber-700">{unitSummary.missing} kalemde miktar yok — birim fiyat geçerli, toplam kesin değildir.</p>}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1"><Label>Anlaşılan toplam bedel * ({basis === 'kdv_dahil' ? 'KDV dahil' : 'KDV hariç'})</Label>
                  <Input inputMode="decimal" value={lumpTotal} onChange={(e) => setLumpTotal(e.target.value)} {...noWheel} />
                </div>
                <div className="space-y-1"><Label>İş kategorisi</Label>
                  <Select value={lumpCategory || undefined} onValueChange={setLumpCategory}>
                    <SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                    <SelectContent className="max-h-72">{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">{isFinite(lumpNet) && lumpNet > 0 && <TotalsLine net={lumpNet} vatRate={vr} currency={currency} label="Bedel" />}</div>
              </div>

              <div className="rounded-md border">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <span className="text-sm font-medium">Ödeme / hakediş aşamaları <span className="font-normal text-muted-foreground">(opsiyonel)</span></span>
                  <div className="flex gap-2">
                    {!plan.length && <Button size="sm" variant="ghost" onClick={() => setPlan([newPRow('İş başlangıcı', '20'), newPRow('İmalatın tamamlanması', '60'), newPRow('Nihai kabul', '20')])}>Örnek: 20/60/20</Button>}
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setPlan((p) => [...p, newPRow()])}><Plus className="h-3.5 w-3.5" />Aşama</Button>
                  </div>
                </div>
                {plan.length > 0 && (
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground">
                      <tr><th className="px-2 py-1 text-left font-medium">Aşama</th><th className="w-28 px-2 py-1 font-medium">Giriş</th><th className="w-28 px-2 py-1 text-right font-medium">Değer</th><th className="w-32 px-2 py-1 text-right font-medium">Tutar (KDV h.)</th><th className="w-36 px-2 py-1 font-medium">Planlanan tarih</th><th className="px-2 py-1 text-left font-medium">Açıklama</th><th className="w-8" /></tr>
                    </thead>
                    <tbody className="divide-y">
                      {plan.map((p) => {
                        const v = parseNum(p.value);
                        const net = !isFinite(v) ? null : p.mode === 'yuzde' ? (isFinite(lumpNet) ? (lumpNet * v) / 100 : null) : safeNet(v);
                        return (
                          <tr key={p.id}>
                            <td className="p-1"><Input className="h-8" value={p.name} onChange={(e) => updPRow(p.id, { name: e.target.value })} /></td>
                            <td className="p-1">
                              <Select value={p.mode} onValueChange={(m) => updPRow(p.id, { mode: m as any })}>
                                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="yuzde">Yüzde %</SelectItem><SelectItem value="tutar">Tutar</SelectItem></SelectContent>
                              </Select>
                            </td>
                            <td className="p-1"><Input className="h-8 text-right" inputMode="decimal" value={p.value} onChange={(e) => updPRow(p.id, { value: e.target.value })} {...noWheel} /></td>
                            <td className="px-2 text-right tabular-nums text-muted-foreground">{net != null && isFinite(net) ? formatCurrencyWithType(net, currency) : '—'}</td>
                            <td className="p-1"><Input className="h-8" type="date" value={p.dueDate} onChange={(e) => updPRow(p.id, { dueDate: e.target.value })} /></td>
                            <td className="p-1"><Input className="h-8" value={p.note} onChange={(e) => updPRow(p.id, { note: e.target.value })} /></td>
                            <td className="p-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPlan((ps) => ps.filter((x) => x.id !== p.id))}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {plan.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 text-xs">
                    <label className="flex items-center gap-2"><Checkbox checked={planComplete} onCheckedChange={(v) => setPlanComplete(!!v)} />Plan eksiksiz (toplam %100 olmalı)</label>
                    {planCheck && (
                      <span className={cn(!planCheck.ok ? 'text-destructive' : planCheck.message ? 'text-amber-700' : 'text-muted-foreground')}>
                        Toplam %{planCheck.sumPercent.toLocaleString('tr-TR')} · {formatCurrencyWithType(planCheck.sumAmount, currency)}
                        {planCheck.message && ` — ${planCheck.message} (fark ${formatCurrencyWithType(planCheck.difference, currency)})`}
                      </span>
                    )}
                  </div>
                )}
                <p className="border-t px-3 py-1.5 text-[11px] text-muted-foreground">Aşamanın tamamlanması veya hakedişe bağlanması ödeme sayılmaz; ödemeler yalnızca Ödemeler ekranından işlenir.</p>
              </div>
            </div>
          )}

          <div className="space-y-1"><Label>Kapsam / açıklama</Label>
            <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="İsteğe bağlı" />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Kaydediliyor...' : 'Anlaşmayı Kaydet'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

function TotalsLine({ net, vatRate, currency, label }: { net: number; vatRate?: number; currency: Currency; label: string }) {
  const b = vatBreakdown(net, vatRate);
  return (
    <div className="text-sm tabular-nums">
      <span className="text-muted-foreground">{label}: </span><span className="font-semibold">{formatCurrencyWithType(b.net, currency)}</span>
      <span className="text-xs text-muted-foreground"> + KDV {formatCurrencyWithType(b.vat, currency)} = {formatCurrencyWithType(b.gross, currency)}</span>
    </div>
  );
}

const tierLabel: Record<string, string> = {
  proje_ozel: 'Bu projedeki fiyat', altyuklenici_son: 'Altyüklenicinin son onaylı fiyatı', diger_kaynak: 'Diğer altyükleniciler (yalnızca bilgi)', manuel: 'Eşleşme yok',
};

function SuggestButton({ query, observations, onPick, projectName }: {
  query: { subcontractor: string; projectId: string; description: string; unit: string; currency: Currency };
  observations: PriceObservation[]; onPick: (o: PriceObservation) => void; projectName: (id: string) => string;
}) {
  const ready = query.subcontractor && query.description.trim() && query.unit.trim();
  const s = ready ? suggestUnitPrice(query, observations) : null;
  const has = !!s && (s.suggested || s.alternatives.length);
  const items: { o: PriceObservation; primary: boolean }[] = s ? [...(s.suggested ? [{ o: s.suggested, primary: true }] : []), ...s.alternatives.slice(0, 6).map((o) => ({ o, primary: false }))] : [];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className={cn('h-7 w-7 shrink-0', has ? 'text-amber-600' : 'text-muted-foreground/40')} disabled={!ready} title="Geçmiş fiyat önerileri">
          <Lightbulb className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <div className="border-b px-3 py-2 text-xs font-medium">{s ? tierLabel[s.tier] : ''}</div>
        <div className="max-h-72 overflow-y-auto">
          {!items.length && <p className="p-3 text-xs text-muted-foreground">Aynı açıklama + ölçü + birim + para birimiyle güvenilir geçmiş fiyat bulunamadı. Fiyatı elle girin.</p>}
          {items.map(({ o, primary }, i) => {
            const otherSub = foldTr(o.subcontractor) !== foldTr(query.subcontractor);
            return (
              <button key={i} type="button" onClick={() => onPick(o)} className={cn('flex w-full items-start justify-between gap-2 border-b px-3 py-2 text-left text-xs hover:bg-muted/50', primary && 'bg-primary/5')}>
                <div className="min-w-0">
                  <div className="truncate font-medium">{o.description}</div>
                  <div className="text-muted-foreground">{projectName(o.projectId)} · {o.subcontractor} · {o.sourceNo} · {formatDate(o.date)}</div>
                  {otherSub && <div className="text-amber-700">başka altyüklenici — otomatik uygulanmaz</div>}
                </div>
                <div className="shrink-0 text-right font-semibold tabular-nums">{formatCurrencyWithType(o.unitPrice, o.currency)}<div className="text-[10px] font-normal text-muted-foreground">/{o.unit} · KDV h.</div></div>
              </button>
            );
          })}
        </div>
        <p className="px-3 py-1.5 text-[10px] text-muted-foreground">Eski fiyatlara zam uygulanmaz. Seçilen fiyat yalnızca bu anlaşmaya yazılır.</p>
      </PopoverContent>
    </Popover>
  );
}

function Detail({ c, projectName, hakedisCount, onClose }: { c: WorkEntry; projectName: (id: string) => string; hakedisCount: number; onClose: () => void }) {
  const basis = readPriceBasis(c);
  const st = agreementValueStatus(c);
  const b = vatBreakdown(c.totalAmount, c.vatRate);
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-xs text-muted-foreground">{c.contractNo}</div>
          <div className="text-base font-semibold">{c.subcontractor}</div>
          <div className="text-xs text-muted-foreground">{projectName(c.projectId)} · {c.workCategory} · {formatDate(c.date)}</div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline">{contractTypeLabels[c.contractType]}</Badge>
        <StatusBadge status={c.approvalStatus} />
        <Badge variant="outline" className={basis === 'bilinmiyor' ? 'text-amber-700' : ''}>
          Fiyat esası: {basis === 'kdv_haric' ? 'KDV hariç' : basis === 'kdv_dahil' ? 'KDV dahil girildi' : 'kayıtlı değil'}
        </Badge>
      </div>
      <dl className="grid grid-cols-2 gap-y-1 tabular-nums">
        <dt className="text-muted-foreground">Bedel (KDV hariç)</dt><dd className="text-right font-semibold">{st === 'bedel_yok' ? '—' : formatCurrencyWithType(b.net, c.currency)}</dd>
        <dt className="text-muted-foreground">KDV %{c.vatRate ?? '—'}</dt><dd className="text-right">{formatCurrencyWithType(b.vat, c.currency)}</dd>
        <dt className="text-muted-foreground">KDV dahil</dt><dd className="text-right">{formatCurrencyWithType(b.gross, c.currency)}</dd>
        <dt className="text-muted-foreground">Bağlı hakediş</dt><dd className="text-right">{hakedisCount}</dd>
      </dl>
      {st === 'tahmini_eksik' && <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">Bazı kalemlerde miktar yok; bedel tahminidir.</p>}
      {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}

      {c.contractType === 'birim_fiyat' ? (
        <div className="max-h-80 overflow-y-auto rounded border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/60 text-muted-foreground"><tr><th className="px-2 py-1 text-left">Kalem</th><th className="px-2 py-1 text-right">Fiyat</th><th className="px-2 py-1 text-right">Miktar</th></tr></thead>
            <tbody className="divide-y">
              {(c.workItemEntries || []).map((w) => (
                <tr key={w.id}>
                  <td className="px-2 py-1"><div>{w.description}</div><div className="text-muted-foreground">{w.workCategory}{w.priceSource ? ` · kaynak ${w.priceSource}` : ''}</div></td>
                  <td className="px-2 py-1 text-right">{formatCurrencyWithType(w.unitPrice, c.currency)}/{w.unit}
                    {w.priceBasis === 'kdv_dahil' && w.enteredUnitPrice != null && <div className="text-muted-foreground">girilen {formatCurrencyWithType(w.enteredUnitPrice, c.currency)} KDV d.</div>}
                  </td>
                  <td className="px-2 py-1 text-right">{w.quantityUnknown || !w.quantity ? '—' : w.quantity.toLocaleString('tr-TR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded border">
          {(c.paymentPlan || []).length === 0 ? <p className="p-2 text-xs text-muted-foreground">Ödeme planı yok</p> : (
            <table className="w-full text-xs">
              <tbody className="divide-y">
                {(c.paymentPlan || []).map((p) => (
                  <tr key={p.id}>
                    <td className="px-2 py-1"><div>{p.name || p.description}</div><div className="text-muted-foreground">{p.dueDate ? formatDate(p.dueDate) : ''}{p.note ? ` · ${p.note}` : ''}</div></td>
                    <td className="px-2 py-1 text-right">{p.percentage != null ? `%${p.percentage}` : c.totalAmount > 0 ? `%${Math.round((p.amount / c.totalAmount) * 1000) / 10}` : ''}</td>
                    <td className="px-2 py-1 text-right">{formatCurrencyWithType(p.amount, c.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild size="sm" variant="outline" className="gap-1"><Link to={`/yapilanisler?edit=${c.id}`}><Pencil className="h-3.5 w-3.5" />Düzenle</Link></Button>
        <Button asChild size="sm" variant="ghost"><Link to={`/yapilanisler?view=${c.id}`}>Sözleşme kaydı</Link></Button>
        <Button asChild size="sm" variant="ghost"><Link to={`/altyukleniciler?name=${encodeURIComponent(c.subcontractor)}`}>Cari hesap</Link></Button>
      </div>
    </div>
  );
}
