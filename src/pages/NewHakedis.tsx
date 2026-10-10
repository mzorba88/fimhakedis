import { useEffect, useMemo, useState, KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/MainLayout';
import { useHakedisStore } from '@/store/hakedisStore';
import { useWorkCategories } from '@/hooks/useWorkCategories';
import { ProjectCombobox } from '@/components/ProjectCombobox';
import { SubcontractorCombobox } from '@/components/SubcontractorCombobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, History, Info, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import * as api from '@/services/supabaseService';
import {
  Currency, SubcontractorHakedis, WorkEntry, contractTypeLabels, currencySymbols, formatCurrencyWithType, hakedisTypeLabels, roleLabels,
} from '@/types/hakedis';
import { agreementValueStatus, readPriceBasis, valueStatusLabels, stableId } from '@/utils/agreements';
import { collectPriceObservations } from '@/utils/priceMemory';
import {
  buildNewHakedis, buildUnitRows, effectiveUnitPrice, isPriceOverridden, lumpSumContext, planItemUsage, priceInfo,
  summarize, unitRowAmount, type ExtraRow, type NewHakedisKind, type PlanSelection, type UnitRow,
} from '@/utils/newHakedis';

const num = (v: string): number | null => {
  if (v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const numInputCls = 'h-8 text-right tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';
const noWheel = (e: React.WheelEvent<HTMLInputElement>) => (e.target as HTMLInputElement).blur();

/** Enter/aşağı ok: aynı sütunda alt satıra geç; yukarı ok: üst satır. Tab varsayılan davranış. */
function gridNav(e: KeyboardEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  const col = el.dataset.col; const row = Number(el.dataset.row);
  if (!col || Number.isNaN(row)) return;
  let target = row;
  if (e.key === 'Enter' || e.key === 'ArrowDown') target = row + (e.shiftKey && e.key === 'Enter' ? -1 : 1);
  else if (e.key === 'ArrowUp') target = row - 1;
  else return;
  e.preventDefault();
  const next = document.querySelector<HTMLInputElement>(`input[data-col="${col}"][data-row="${target}"]`);
  next?.focus(); next?.select();
}

const makeExtra = (): ExtraRow => ({ id: stableId('ex'), description: '', workCategory: '', unit: 'adet', quantity: null, unitPrice: null, lumpAmount: null });

export default function NewHakedis() {
  const navigate = useNavigate();
  const { projects, workEntries, subcontractors, subcontractorHakedisler, addSubcontractorHakedis, addActivityLog, currentUser, setSubcontractorHakedisler } = useHakedisStore();
  const { categories } = useWorkCategories();

  const [projectId, setProjectId] = useState('');
  const [subcontractor, setSubcontractor] = useState('');
  const [contractId, setContractId] = useState('');
  const [kind, setKind] = useState<NewHakedisKind>('ara_hakedis');
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [vatRate, setVatRate] = useState('20');
  const [basis, setBasis] = useState<'kdv_haric' | 'kdv_dahil'>('kdv_haric');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [unitRows, setUnitRows] = useState<UnitRow[]>([]);
  const [extraRows, setExtraRows] = useState<ExtraRow[]>([]);
  const [freeAmount, setFreeAmount] = useState('');
  const [planSel, setPlanSel] = useState<PlanSelection[]>([]);
  const [saving, setSaving] = useState(false);

  const subNames = useMemo(() => {
    const s = new Set<string>();
    subcontractors.forEach((x) => s.add(x.name));
    workEntries.filter((e) => !projectId || e.projectId === projectId).forEach((e) => e.subcontractor && s.add(e.subcontractor));
    return [...s].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [subcontractors, workEntries, projectId]);

  const contracts = useMemo(
    () => workEntries.filter((e) => e.projectId === projectId && e.subcontractor === subcontractor && e.approvalStatus !== 'revize'),
    [workEntries, projectId, subcontractor],
  );
  const contract: WorkEntry | undefined = contracts.find((c) => c.id === contractId);
  const observations = useMemo(() => collectPriceObservations(workEntries, subcontractorHakedisler), [workEntries, subcontractorHakedisler]);
  const isDir = currentUser.role === 'direktor';

  // Anlaşma değişince: kalemleri otomatik getir, para birimi/KDV oranını anlaşmadan al
  useEffect(() => {
    setPlanSel([]); setFreeAmount('');
    if (!contract) { setUnitRows([]); return; }
    setCurrency(contract.currency || 'TRY');
    setVatRate(contract.vatRate != null ? String(contract.vatRate) : '');
    setUnitRows(contract.contractType === 'birim_fiyat' ? buildUnitRows(contract, subcontractorHakedisler) : []);
    if (kind === 'sozlesmesiz') setKind('ara_hakedis');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  useEffect(() => { if (contracts.length === 1 && !contractId && kind !== 'sozlesmesiz') setContractId(contracts[0].id); }, [contracts, contractId, kind]);
  useEffect(() => { setContractId(''); }, [projectId, subcontractor]);
  useEffect(() => { if (kind === 'sozlesmesiz') { setContractId(''); if (!extraRows.length) setExtraRows([makeExtra()]); } }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const vr = num(vatRate) ?? undefined;
  const usage = useMemo(() => (contract && contract.contractType === 'goturu_bedel' ? planItemUsage(contract, subcontractorHakedisler) : []), [contract, subcontractorHakedisler]);
  const hasPlan = usage.length > 0;
  const lumpCtx = contract && contract.contractType === 'goturu_bedel' ? lumpSumContext(contract, subcontractorHakedisler) : null;

  const subWorkCategory = subcontractors.find((s) => s.name === subcontractor)?.workCategory || '';
  const result = useMemo(() => buildNewHakedis({
    kind, contract, projectId, subcontractor, currency, vatRate: vr, date, description, isUrgent, basis,
    unitRows, extraRows, freeAmount: num(freeAmount), planSelections: planSel,
    user: { id: currentUser.id, role: currentUser.role, label: roleLabels[currentUser.role] },
    hakedisler: subcontractorHakedisler, subWorkCategory,
  }), [kind, contract, projectId, subcontractor, currency, vr, date, description, isUrgent, basis, unitRows, extraRows, freeAmount, planSel, currentUser, subcontractorHakedisler, subWorkCategory]);
  const sum = summarize(result.mainNet + result.extraNet, vr);
  const fmt = (n: number) => formatCurrencyWithType(n, currency);
  const showBasis = (net: number) => (basis === 'kdv_dahil' && vr ? net * (1 + vr / 100) : net);

  const recentFile = useMemo(
    () => subcontractorHakedisler.filter((h) => h.projectId === projectId && h.subcontractor === subcontractor).slice(0, 8),
    [subcontractorHakedisler, projectId, subcontractor],
  );

  const updUnit = (id: string, patch: Partial<UnitRow>) => setUnitRows((p) => p.map((r) => (r.workItemEntryId === id ? { ...r, ...patch } : r)));
  const updExtra = (id: string, patch: Partial<ExtraRow>) => setExtraRows((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const setSel = (planItemId: string, amount: number | null | undefined) => setPlanSel((p) => {
    const rest = p.filter((s) => s.planItemId !== planItemId);
    return amount === undefined ? rest : [...rest, { planItemId, amount }];
  });

  const kindAllowed = (k: NewHakedisKind) => (k === 'sozlesmesiz' ? true : !!contract);

  async function save() {
    if (!result.data) { toast.error(result.errors[0] || 'Eksik bilgi'); return; }
    setSaving(true);
    try {
      // Kaydetmeden hemen önce güncel hakedişleri yeniden oku ve kontrolü tekrarla (atomik DEĞİL — eşzamanlı yazımı tamamen engellemez)
      const fresh: SubcontractorHakedis[] = await api.fetchHakedisler();
      const recheck = buildNewHakedis({
        kind, contract, projectId, subcontractor, currency, vatRate: vr, date, description, isUrgent, basis,
        unitRows, extraRows, freeAmount: num(freeAmount), planSelections: planSel,
        user: { id: currentUser.id, role: currentUser.role, label: roleLabels[currentUser.role] }, hakedisler: fresh, subWorkCategory,
      });
      if (!recheck.data) { setSubcontractorHakedisler(fresh); toast.error(recheck.errors[0] || 'Kontrol başarısız'); return; }
      const created = await addSubcontractorHakedis(recheck.data);
      await addActivityLog(
        'hakedis_created',
        `${created.hakedisNo} ${kind === 'sozlesmesiz' ? 'Sözleşmesiz Hakediş' : hakedisTypeLabels[created.hakedisType]} oluşturuldu (Hızlı Hakediş)`,
        `Altyüklenici: ${subcontractor} - Tutar: ${fmt(created.totalAmount)}${created.planLinks?.length ? ` - Aşama bağlantısı: ${created.planLinks.length}` : ''}`,
        created.id, 'hakedis',
      );
      toast.success(`${created.hakedisNo} kaydedildi`);
      navigate(`/hakedisler?hakedis=${created.id}`);
    } catch (e: any) {
      toast.error('Kayıt başarısız: ' + (e?.message || ''));
    } finally { setSaving(false); }
  }

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="page-header">
          <div>
            <h1 className="page-title">Hızlı Hakediş</h1>
            <p className="page-subtitle">Proje ve altyükleniciyi seçin; anlaşmadaki fiyatlar veya ödeme aşamaları otomatik gelir.</p>
          </div>
          <Button variant="outline" asChild><Link to="/hakedisler">Klasik hakediş ekranı</Link></Button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5 min-w-0">
            {/* 1-4: seçimler */}
            <section className="rounded-lg border bg-card p-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5"><Label>1. Proje</Label>
                  <ProjectCombobox projects={projects.filter((p) => p.status === 'aktif' || p.id === projectId)} value={projectId} onChange={setProjectId} placeholder="Proje seçin" />
                </div>
                <div className="space-y-1.5"><Label>2. Altyüklenici</Label>
                  <SubcontractorCombobox names={subNames} value={subcontractor} onChange={(v) => setSubcontractor(v)} />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5"><Label>3. İş anlaşması</Label>
                  <Select value={contractId} onValueChange={setContractId} disabled={!projectId || !subcontractor || kind === 'sozlesmesiz'}>
                    <SelectTrigger><SelectValue placeholder={contracts.length ? 'Anlaşma seçin' : 'Bu proje + altyüklenici için anlaşma yok'} /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {contracts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.contractNo} · {contractTypeLabels[c.contractType]} · {c.workCategory || 'Sınıflandırılmamış'}{c.approvalStatus !== 'onaylandi' ? ' (onay bekliyor)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>4. Hakediş türü</Label>
                  <ToggleGroup type="single" value={kind} onValueChange={(v) => v && setKind(v as NewHakedisKind)} className="justify-start flex-wrap" variant="outline" size="sm">
                    <ToggleGroupItem value="ara_hakedis" disabled={!kindAllowed('ara_hakedis')}>Ara Hakediş</ToggleGroupItem>
                    <ToggleGroupItem value="alelhesap" disabled={!kindAllowed('alelhesap')}>Alelhesap</ToggleGroupItem>
                    <ToggleGroupItem value="kesin_hesap" disabled={!kindAllowed('kesin_hesap')}>Kesin Hesap</ToggleGroupItem>
                    <ToggleGroupItem value="sozlesmesiz">Sözleşmesiz</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
              {contract && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{contractTypeLabels[contract.contractType]}</Badge>
                  <Badge variant="outline">Bedel: {valueStatusLabels[agreementValueStatus(contract)]}</Badge>
                  <Badge variant="outline">Fiyat esası: {({ kdv_haric: 'KDV hariç', kdv_dahil: 'KDV dahil', bilinmiyor: 'Bilinmiyor' } as const)[readPriceBasis(contract)]}</Badge>
                  <span>Anlaşma fiyatları KDV hariç saklanır.</span>
                  <Link to="/is-anlasmalari" className="underline">Anlaşmayı aç</Link>
                </div>
              )}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
                <div className="space-y-1.5"><Label>Tarih</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>Para birimi</Label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)} disabled={!!contract}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{(['TRY', 'GBP', 'USD', 'EUR'] as Currency[]).map((c) => <SelectItem key={c} value={c}>{currencySymbols[c]} {c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label>KDV oranı (%)</Label>
                  <Input inputMode="decimal" className={numInputCls} value={vatRate} onWheel={noWheel} onChange={(e) => setVatRate(e.target.value)} />
                </div>
                <div className="space-y-1.5 col-span-2"><Label>Tutar girişi</Label>
                  <ToggleGroup type="single" value={basis} onValueChange={(v) => v && setBasis(v as any)} variant="outline" size="sm" className="justify-start">
                    <ToggleGroupItem value="kdv_haric">KDV hariç</ToggleGroupItem>
                    <ToggleGroupItem value="kdv_dahil" disabled={!(vr && vr > 0)}>KDV dahil</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </section>

            {kind === 'kesin_hesap' && (
              <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div>Kesin hesap bu ekranda hazırlanmaz. Yeni kesin hesap ekranı Aşama 4B'de gelecek. Şimdilik mevcut güvenilir formu kullanın:{' '}
                  <Link to="/hakedisler" className="underline font-medium">Hakedişler → Yeni Hakediş</Link>.</div>
              </section>
            )}

            {/* 5-6: birim fiyat kalemleri */}
            {kind === 'ara_hakedis' && contract?.contractType === 'birim_fiyat' && (
              <section className="rounded-lg border bg-card">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h2 className="font-semibold">Anlaşma kalemleri — bu dönem yapılan yeni metraj</h2>
                  <span className="text-xs text-muted-foreground">Miktarı boş kalan kalemler hakedişe girmez · Enter: alt satır</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2">Açıklama</th>
                        <th className="text-left px-2 py-2 w-40">İş kategorisi</th>
                        <th className="px-2 py-2 w-16">Birim</th>
                        <th className="text-right px-2 py-2 w-36">Birim fiyat (hariç)</th>
                        <th className="text-right px-2 py-2 w-28">Önceki onaylı</th>
                        <th className="text-right px-2 py-2 w-28">Bu dönem</th>
                        <th className="text-right px-3 py-2 w-32">Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitRows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">Bu anlaşmada birim fiyat kalemi yok.</td></tr>}
                      {unitRows.map((r, idx) => {
                        const amt = unitRowAmount(r); const over = isPriceOverridden(r);
                        const info = priceInfo(r, { subcontractor, projectId, currency }, observations);
                        return (
                          <tr key={r.workItemEntryId} className={cn('border-t', amt > 0 && 'bg-primary/5')}>
                            <td className="px-3 py-1.5">{r.description}</td>
                            <td className="px-2 py-1.5">
                              <Select value={r.workCategory || '__none'} onValueChange={(v) => updUnit(r.workItemEntryId, { workCategory: v === '__none' ? '' : v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent className="max-h-72">
                                  <SelectItem value="__none">Sınıflandırılmamış</SelectItem>
                                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-2 py-1.5 text-center text-muted-foreground">{r.unit}</td>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-1 justify-end">
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <button type="button" className={cn('tabular-nums rounded px-1.5 py-0.5 hover:bg-muted', over && 'text-amber-700 font-medium')} title="Fiyatı yalnızca bu hakediş için değiştir / geçmiş fiyatlar">
                                      {fmt(effectiveUnitPrice(r))}{over && ' *'}
                                    </button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-80 space-y-3" align="end">
                                    <div className="text-xs text-muted-foreground">Anlaşma fiyatı: <b>{fmt(r.agreementUnitPrice)}</b> (KDV hariç). Değişiklik yalnızca bu hakedişe uygulanır; anlaşma değişmez.</div>
                                    <div className="space-y-1"><Label className="text-xs">Bu hakediş için birim fiyat ({basis === 'kdv_dahil' ? 'KDV dahil' : 'KDV hariç'})</Label>
                                      <Input inputMode="decimal" className={numInputCls} onWheel={noWheel}
                                        defaultValue={r.overrideUnitPrice != null ? String(+showBasis(r.overrideUnitPrice).toFixed(4)) : ''}
                                        onBlur={(e) => {
                                          const v = num(e.target.value);
                                          updUnit(r.workItemEntryId, { overrideUnitPrice: v == null ? null : (basis === 'kdv_dahil' && vr ? Math.round((v / (1 + vr / 100)) * 10000) / 10000 : v) });
                                        }} placeholder={String(r.agreementUnitPrice)} />
                                    </div>
                                    <div className="space-y-1"><Label className="text-xs">Gerekçe</Label>
                                      <Input value={r.overrideReason} onChange={(e) => updUnit(r.workItemEntryId, { overrideReason: e.target.value })} placeholder="örn. ek detay, malzeme farkı" />
                                    </div>
                                    {over && <Button size="sm" variant="ghost" onClick={() => updUnit(r.workItemEntryId, { overrideUnitPrice: null, overrideReason: '' })}>Anlaşma fiyatına dön</Button>}
                                    <div className="border-t pt-2 space-y-1">
                                      <div className="text-xs font-medium flex items-center gap-1"><History className="h-3 w-3" />Geçmiş fiyatlar</div>
                                      {[...(info.suggested ? [info.suggested] : []), ...info.alternatives].slice(0, 6).map((o, i) => (
                                        <div key={i} className="text-xs flex justify-between gap-2">
                                          <span className="truncate">{o.sourceNo} · {o.subcontractor === subcontractor ? 'aynı altyüklenici' : o.subcontractor} · {o.date?.slice(0, 10)}</span>
                                          <span className="tabular-nums">{fmt(o.unitPrice)}</span>
                                        </div>
                                      ))}
                                      {!info.suggested && !info.alternatives.length && <div className="text-xs text-muted-foreground">Eşleşen onaylı fiyat yok (birim/ölçü/para birimi uyumlu olmalı).</div>}
                                      {info.tier === 'diger_kaynak' && <div className="text-[11px] text-muted-foreground">Diğer altyüklenici fiyatları yalnızca bilgi; otomatik uygulanmaz.</div>}
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground" title={r.prevPendingQty ? `Onay bekleyen: ${r.prevPendingQty}` : ''}>
                              {r.prevApprovedQty || '—'}{r.prevPendingQty ? <span className="text-amber-600"> +{r.prevPendingQty}</span> : null}
                            </td>
                            <td className="px-2 py-1.5">
                              <Input data-col="qty" data-row={idx} inputMode="decimal" className={numInputCls} onWheel={noWheel} onKeyDown={gridNav}
                                aria-label={`${r.description} bu dönem miktar`}
                                value={r.quantity ?? ''} onChange={(e) => updUnit(r.workItemEntryId, { quantity: num(e.target.value) })} />
                            </td>
                            <td className="px-3 py-1.5 text-right tabular-nums font-medium">{amt > 0 ? fmt(showBasis(amt)) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="px-4 py-2 text-xs text-muted-foreground border-t">Önceki onaylı metrajlar yalnızca bilgi içindir; bu döneme eklenmez. Eski metrajlar kendi fiyatlarıyla kalır.</p>
              </section>
            )}

            {/* Götürü: aşamalar veya serbest tutar */}
            {kind === 'ara_hakedis' && contract?.contractType === 'goturu_bedel' && (
              <section className="rounded-lg border bg-card">
                <div className="px-4 py-3 border-b"><h2 className="font-semibold">{hasPlan ? 'Ödeme aşamaları' : 'Götürü bedel — serbest tutar'}</h2></div>
                {hasPlan ? (
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs text-muted-foreground">
                      <tr><th className="w-10" /><th className="text-left px-2 py-2">Aşama</th><th className="text-right px-2 py-2">Aşama tutarı</th><th className="text-right px-2 py-2">Onaylı bağlı</th><th className="text-right px-2 py-2">Onay bekleyen</th><th className="text-right px-2 py-2">Kalan</th><th className="text-right px-3 py-2 w-36">Bu hakediş</th></tr>
                    </thead>
                    <tbody>
                      {usage.map((u, idx) => {
                        const sel = planSel.find((s) => s.planItemId === u.planItemId);
                        return (
                          <tr key={u.planItemId} className={cn('border-t', sel && 'bg-primary/5')}>
                            <td className="text-center"><Checkbox checked={!!sel} disabled={u.remaining <= 0 && !sel} aria-label={`${u.name} seç`}
                              onCheckedChange={(c) => setSel(u.planItemId, c ? +showBasis(Math.max(0, u.remaining)).toFixed(2) : undefined)} /></td>
                            <td className="px-2 py-1.5">{u.name || '—'}{u.hakedisNos.length > 0 && <div className="text-[11px] text-muted-foreground">{u.hakedisNos.join(', ')}</div>}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(u.planned)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{fmt(u.approved)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums text-amber-700">{u.pending ? fmt(u.pending) : '—'}</td>
                            <td className={cn('px-2 py-1.5 text-right tabular-nums', u.remaining <= 0 && 'text-muted-foreground')}>{fmt(u.remaining)}</td>
                            <td className="px-3 py-1.5">
                              <Input data-col="plan" data-row={idx} inputMode="decimal" className={numInputCls} onWheel={noWheel} onKeyDown={gridNav} disabled={!sel}
                                aria-label={`${u.name} bağlanan tutar`}
                                value={sel?.amount ?? ''} onChange={(e) => setSel(u.planItemId, num(e.target.value))} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-4 space-y-3">
                    {lumpCtx && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <Stat label="Anlaşma bedeli" v={fmt(lumpCtx.total)} /><Stat label="Onaylı hakediş" v={fmt(lumpCtx.approved)} />
                        <Stat label="Onay bekleyen" v={fmt(lumpCtx.pending)} /><Stat label="Kalan (bilgi)" v={fmt(lumpCtx.remaining)} />
                      </div>
                    )}
                    <div className="max-w-xs space-y-1.5"><Label>Bu dönem tutarı ({basis === 'kdv_dahil' ? 'KDV dahil' : 'KDV hariç'})</Label>
                      <Input inputMode="decimal" className={numInputCls} onWheel={noWheel} value={freeAmount} onChange={(e) => setFreeAmount(e.target.value)} />
                    </div>
                    <p className="text-xs text-muted-foreground">Anlaşma bedeli otomatik olarak dönem hakedişi sayılmaz.</p>
                  </div>
                )}
                <p className="px-4 py-2 text-xs text-muted-foreground border-t">Aşamaya bağlamak ödeme yapıldığı anlamına gelmez. Aşım kontrolü kayıttan hemen önce yeniden yapılır; ancak aynı anda iki kişi kaydederse veritabanı bunu tek başına engelleyemez.</p>
              </section>
            )}

            {kind === 'alelhesap' && contract && (
              <section className="rounded-lg border bg-card p-4 space-y-2">
                <h2 className="font-semibold">Alelhesap tutarı</h2>
                <div className="max-w-xs"><Input inputMode="decimal" className={numInputCls} onWheel={noWheel} value={freeAmount} onChange={(e) => setFreeAmount(e.target.value)} placeholder={basis === 'kdv_dahil' ? 'KDV dahil' : 'KDV hariç'} /></div>
                <p className="text-xs text-muted-foreground">Mevcut çalışma şekli korunur; avans/tahakkuk ayrımı henüz kaydedilmiyor ve tahminle mahsup yapılmaz.</p>
              </section>
            )}

            {/* Ek işler / sözleşmesiz kalemler */}
            {kind !== 'kesin_hesap' && (kind === 'sozlesmesiz' || contract) && (
              <section className="rounded-lg border bg-card">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h2 className="font-semibold">{kind === 'sozlesmesiz' ? 'Hakediş kalemleri (sözleşmesiz)' : 'Ek işler'}</h2>
                  <Button size="sm" variant="outline" onClick={() => setExtraRows((p) => [...p, makeExtra()])}><Plus className="h-4 w-4 mr-1" />Satır ekle</Button>
                </div>
                {extraRows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs text-muted-foreground">
                        <tr><th className="text-left px-3 py-2">Açıklama</th><th className="text-left px-2 py-2 w-40">Kategori</th><th className="px-2 py-2 w-20">Birim</th><th className="text-right px-2 py-2 w-24">Miktar</th><th className="text-right px-2 py-2 w-28">Birim fiyat</th><th className="text-right px-2 py-2 w-28">veya Toplam</th><th className="w-10" /></tr>
                      </thead>
                      <tbody>
                        {extraRows.map((r, idx) => (
                          <tr key={r.id} className="border-t">
                            <td className="px-3 py-1.5"><Input className="h-8" value={r.description} onChange={(e) => updExtra(r.id, { description: e.target.value })} placeholder="Açıklama" aria-label="Ek iş açıklama" /></td>
                            <td className="px-2 py-1.5">
                              <Select value={r.workCategory || '__none'} onValueChange={(v) => updExtra(r.id, { workCategory: v === '__none' ? '' : v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent className="max-h-72"><SelectItem value="__none">Sınıflandırılmamış</SelectItem>{categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                              </Select>
                            </td>
                            <td className="px-2 py-1.5"><Input className="h-8" value={r.unit} onChange={(e) => updExtra(r.id, { unit: e.target.value })} /></td>
                            <td className="px-2 py-1.5"><Input data-col="exq" data-row={idx} onKeyDown={gridNav} inputMode="decimal" className={numInputCls} onWheel={noWheel} value={r.quantity ?? ''} onChange={(e) => updExtra(r.id, { quantity: num(e.target.value) })} aria-label="Ek iş miktar" /></td>
                            <td className="px-2 py-1.5"><Input data-col="exp" data-row={idx} onKeyDown={gridNav} inputMode="decimal" className={numInputCls} onWheel={noWheel} value={r.unitPrice ?? ''} onChange={(e) => updExtra(r.id, { unitPrice: num(e.target.value) })} aria-label="Ek iş birim fiyat" /></td>
                            <td className="px-2 py-1.5"><Input data-col="exl" data-row={idx} onKeyDown={gridNav} inputMode="decimal" className={numInputCls} onWheel={noWheel} value={r.lumpAmount ?? ''} onChange={(e) => updExtra(r.id, { lumpAmount: num(e.target.value) })} aria-label="Ek iş toplam" /></td>
                            <td className="text-center"><Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setExtraRows((p) => p.filter((x) => x.id !== r.id))} aria-label="Satırı sil"><Trash2 className="h-4 w-4" /></Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {kind !== 'sozlesmesiz' && <p className="px-4 py-2 text-xs text-muted-foreground border-t">Ek işler ayrı saklanır ve aşama kullanımına dahil edilmez. Sözleşme kapsamında olup olmadığı varsayılmaz.</p>}
              </section>
            )}

            <section className="rounded-lg border bg-card p-4 space-y-3">
              <div className="space-y-1.5"><Label>Açıklama (isteğe bağlı)</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={isUrgent} onCheckedChange={(c) => setIsUrgent(c === true)} /><span className="font-medium text-destructive">ACİL</span> olarak işaretle</label>
            </section>
          </div>

          {/* 7: özet */}
          <aside className="space-y-4 lg:sticky lg:top-20 self-start">
            <section className="rounded-lg border bg-card p-4 space-y-3">
              <h2 className="font-semibold">Özet</h2>
              <Row k="Ana iş (KDV hariç)" v={fmt(result.mainNet)} />
              <Row k="Ek işler (KDV hariç)" v={fmt(result.extraNet)} />
              <div className="border-t pt-2 space-y-1.5">
                <Row k="KDV hariç toplam" v={fmt(sum.net)} strong />
                <Row k={`KDV (%${sum.vatRate})`} v={fmt(sum.vat)} />
                <Row k="KDV dahil toplam" v={fmt(sum.gross)} strong />
              </div>
              {contract && <div className="text-xs text-muted-foreground">Numara: {result.data?.hakedisNo || '—'} · {isDir ? 'Direktör kaydı: onaylı olarak açılır' : 'Onaya gönderilir'}</div>}
              {result.errors.length > 0 && <ul className="text-xs text-destructive space-y-0.5">{result.errors.map((e) => <li key={e}>• {e}</li>)}</ul>}
              {result.warnings.length > 0 && <ul className="text-xs text-amber-700 space-y-0.5">{result.warnings.map((e) => <li key={e}>• {e}</li>)}</ul>}
              <Button className="w-full" disabled={!result.data || saving} onClick={save}>{saving ? 'Kaydediliyor…' : 'Hakedişi kaydet'}</Button>
              <p className="text-[11px] text-muted-foreground flex gap-1"><Info className="h-3 w-3 mt-0.5 shrink-0" />Tutarlar KDV hariç saklanır; KDV yalnızca gösterimde eklenir.</p>
            </section>
            {recentFile.length > 0 && (
              <Collapsible className="rounded-lg border bg-card">
                <CollapsibleTrigger className="w-full flex items-center justify-between p-3 text-sm font-medium">Bu dosyadaki son hakedişler <ChevronDown className="h-4 w-4" /></CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3 space-y-1">
                  {recentFile.map((h) => (
                    <Link key={h.id} to={`/hakedisler?hakedis=${h.id}`} className="flex justify-between text-xs hover:underline">
                      <span>{h.hakedisNo} · {hakedisTypeLabels[h.hakedisType] || ''}</span>
                      <span className="tabular-nums">{formatCurrencyWithType(h.totalAmount, h.currency)}</span>
                    </Link>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}
          </aside>
        </div>
      </div>
    </MainLayout>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return <div className={cn('flex justify-between text-sm', strong && 'font-semibold')}><span className="text-muted-foreground">{k}</span><span className="tabular-nums">{v}</span></div>;
}
function Stat({ label, v }: { label: string; v: string }) {
  return <div className="rounded border p-2"><div className="text-muted-foreground">{label}</div><div className="font-medium tabular-nums">{v}</div></div>;
}
