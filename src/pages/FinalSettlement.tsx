import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/MainLayout';
import { ProjectCombobox } from '@/components/ProjectCombobox';
import { SubcontractorCombobox } from '@/components/SubcontractorCombobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useHakedisStore } from '@/store/hakedisStore';
import { useWorkCategories } from '@/hooks/useWorkCategories';
import { formatCurrencyWithType } from '@/types/hakedis';
import { stableId } from '@/utils/agreements';
import { buildUnitRows, type ExtraRow } from '@/utils/newHakedis';
import { prepareFinalSettlement, type FinalMeter } from '@/utils/finalSettlement4B';
import * as api from '@/services/supabaseService';

const number = (s: string): number | null => {
  if (!s.trim()) return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const newExtra = (): ExtraRow => ({
  id: stableId('ex'), description: '', workCategory: '', unit: 'adet', quantity: null, unitPrice: null, lumpAmount: null,
});

export default function FinalSettlement() {
  const navigate = useNavigate();
  const { projects, workEntries, subcontractors, subcontractorHakedisler, currentUser, addSubcontractorHakedis, addActivityLog } = useHakedisStore();
  const { categories } = useWorkCategories();
  const [projectId, setProjectId] = useState('');
  const [subcontractor, setSubcontractor] = useState('');
  const [contractId, setContractId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [rows, setRows] = useState<FinalMeter[]>([]);
  const [extras, setExtras] = useState<ExtraRow[]>([]);
  const [extraBasis, setExtraBasis] = useState<'kdv_haric'|'kdv_dahil'>('kdv_haric');
  const [saving, setSaving] = useState(false);
  const contracts = useMemo(() => workEntries.filter(c =>
    c.projectId === projectId && c.subcontractor === subcontractor &&
    c.contractType === 'birim_fiyat' && c.approvalStatus !== 'revize'
  ), [workEntries, projectId, subcontractor]);
  const contract = contracts.find(c => c.id === contractId);
  const names = useMemo(() => [...new Set([
    ...subcontractors.map(s => s.name),
    ...workEntries.filter(c => !projectId || c.projectId === projectId).map(c => c.subcontractor),
  ])].sort((a,b)=>a.localeCompare(b,'tr')), [subcontractors,workEntries,projectId]);
  useEffect(() => {
    if (contracts.length === 1 && !contractId) setContractId(contracts[0].id);
  }, [contracts, contractId]);
  useEffect(() => {
    if (!contract) { setRows([]); return; }
    const initial = buildUnitRows(contract, subcontractorHakedisler);
    setRows(initial.map(r => ({
      workItemEntryId: r.workItemEntryId, finalQuantity: null,
      newUnitPrice: r.agreementUnitPrice, workCategory: r.workCategory,
    })));
    setExtras([]);
  // Reinitialization only when another agreement is chosen
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);
  const analysis = useMemo(() => contract ? prepareFinalSettlement({
    contract, all: subcontractorHakedisler, date, rows, newExtras: extras,
    extraBasis, vatRate: contract.vatRate, description,
    user: { id: currentUser.id, role: currentUser.role, label: currentUser.name },
  }) : null, [contract, subcontractorHakedisler, date, rows, extras, extraBasis, description, currentUser]);
  const fmt = (n: number) => formatCurrencyWithType(n, contract?.currency || 'GBP');
  const changeRow = (id: string, patch: Partial<FinalMeter>) =>
    setRows(p => p.map(x => x.workItemEntryId === id ? { ...x, ...patch } : x));
  const changeExtra = (id: string, patch: Partial<ExtraRow>) =>
    setExtras(p => p.map(x => x.id === id ? { ...x, ...patch } : x));

  async function save() {
    if (!contract || !analysis?.data) return;
    setSaving(true);
    try {
      // Client-side refresh is not atomic. Do not imply it enforces DB-level security.
      const fresh = await api.fetchHakedisler();
      const checked = prepareFinalSettlement({
        contract, all: fresh, date, rows, newExtras: extras, extraBasis,
        vatRate: contract.vatRate, description,
        user: { id: currentUser.id, role: currentUser.role, label: currentUser.name },
      });
      if (!checked.data) { toast.error(checked.errors[0] || 'Kesin hesap doğrulaması başarısız'); return; }
      const result = await addSubcontractorHakedis(checked.data);
      await addActivityLog('hakedis_created', result.hakedisNo + ' Kesin Hesap hazırlandı',
        'Kümülatif imalat: ' + fmt(result.totalAmount) + '; yeni ek işler: ' + fmt(checked.newExtraNet),
        result.id, 'hakedis');
      toast.success('Kesin hesap kaydedildi');
      navigate('/hakedisler?view=' + result.id);
    } catch (e: any) { toast.error('Kayıt hatası: ' + (e?.message || 'Bilinmeyen hata')); }
    finally { setSaving(false); }
  }

  return <MainLayout><div className="space-y-5">
    <div className="flex justify-between items-center gap-2">
      <div><h1 className="page-title">Kesin Hesap — Nihai Metraj ve Ek İşler</h1>
      <p className="page-subtitle">Eski ara hakedişler ve ek işler mahsup edilir; yalnızca yeni üretim tekrar tahakkuk eder.</p></div>
      <Button variant="outline" asChild><Link to="/hakedis-yeni">Hızlı Hakediş</Link></Button>
    </div>
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5 min-w-0">
        <section className="rounded-lg border bg-card p-4 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>1. Proje</Label><ProjectCombobox projects={projects} value={projectId} onChange={v=>{setProjectId(v);setSubcontractor('');setContractId('');}} /></div>
            <div><Label>2. Altyüklenici</Label><SubcontractorCombobox names={names} value={subcontractor} onChange={v=>{setSubcontractor(v);setContractId('');}} /></div>
          </div>
          <div><Label>3. Birim fiyatlı iş anlaşması</Label>
            <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={contractId} onChange={e=>setContractId(e.target.value)}>
              <option value="">Anlaşma seçiniz</option>{contracts.map(c=><option key={c.id} value={c.id}>{c.contractNo} — {c.workCategory}</option>)}
            </select>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div><Label>Kesin hesap tarihi</Label><Input type="date" value={date} onChange={e=>setDate(e.target.value)} /></div>
            <div><Label>Ek iş fiyat girişi</Label><select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={extraBasis} onChange={e=>setExtraBasis(e.target.value as any)}>
              <option value="kdv_haric">KDV hariç</option><option value="kdv_dahil">KDV dahil</option>
            </select></div>
          </div>
        </section>
        {contract && <>
          <section className="rounded-lg border bg-card overflow-hidden">
            <h2 className="px-4 py-3 border-b font-semibold">Nihai metraj</h2>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs"><tr><th className="text-left p-2">İş kalemi</th><th className="p-2 text-right">Önceki metraj</th><th className="p-2 text-right">Nihai toplam</th><th className="p-2 text-right">Yeni metraj fiyatı</th><th className="p-2 text-right">Nihai tutar</th></tr></thead>
              <tbody>{(contract.workItemEntries || []).map(item=>{
                const row=rows.find(r=>r.workItemEntryId===item.id);
                const calc=analysis?.lines.find(l=>l.key===item.id);
                const prev=(subcontractorHakedisler.filter(h=>h.contractId===contract.id&&h.approvalStatus==='onaylandi'&&h.hakedisType==='ara_hakedis').flatMap(h=>h.hakedisItems||[]).filter(x=>x.workItemEntryId===item.id).reduce((s,x)=>s+x.quantity,0));
                return <tr className="border-t" key={item.id}>
                  <td className="p-2">{item.description}<div className="text-xs text-muted-foreground">{item.workCategory} · {item.unit}</div></td>
                  <td className="p-2 text-right">{prev}</td>
                  <td className="p-2"><Input className="h-8 min-w-24 text-right" type="number" min="0" step="any" aria-label={item.description+' nihai metraj'} value={row?.finalQuantity??''} onChange={e=>changeRow(item.id,{finalQuantity:number(e.target.value)})}/></td>
                  <td className="p-2"><Input className="h-8 min-w-24 text-right" type="number" min="0" step="any" aria-label={item.description+' yeni birim fiyat'} value={row?.newUnitPrice??''} onChange={e=>changeRow(item.id,{newUnitPrice:Number(e.target.value)})}/></td>
                  <td className="p-2 text-right font-medium">{calc?fmt(calc.totalNet):'—'}</td>
                </tr>;
              })}</tbody>
            </table></div><p className="p-3 border-t text-xs text-muted-foreground">Önceki miktarlar kendi onaylı tarihî fiyatlarıyla korunur; bu fiyat yalnızca yeni metraja uygulanır.</p>
          </section>
          <section className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
              <h2 className="font-semibold">İş sırasında ortaya çıkan ek işler</h2>
              <Button size="sm" variant="outline" onClick={()=>setExtras(p=>[...p,newExtra()])}><Plus className="h-4 w-4 mr-1"/>Ek iş ekle</Button>
            </div>
            <p className="p-3 text-xs text-muted-foreground">Önceki ara hakedişlerdeki ek işler otomatik taşınır; burada yalnızca henüz hakedişe girmemiş yeni ek işleri yazın.</p>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs"><tr><th className="text-left p-2">Açıklama</th><th className="text-left p-2">Kategori</th><th className="p-2">Birim</th><th className="p-2 text-right">Miktar</th><th className="p-2 text-right">Birim fiyat</th><th className="p-2 text-right">veya Toplam</th><th/></tr></thead>
              <tbody>{extras.map(ex=><tr key={ex.id} className="border-t">
                <td className="p-2"><Input className="min-w-36" placeholder="Ek iş açıklaması" value={ex.description} onChange={e=>changeExtra(ex.id,{description:e.target.value})}/></td>
                <td className="p-2"><select className="h-10 rounded-md border bg-background px-1 min-w-32" value={ex.workCategory} onChange={e=>changeExtra(ex.id,{workCategory:e.target.value})}><option value="">Sınıflandırılmamış</option>{categories.map(cat=><option key={cat} value={cat}>{cat}</option>)}</select></td>
                <td className="p-2"><Input className="w-20" value={ex.unit} onChange={e=>changeExtra(ex.id,{unit:e.target.value})}/></td>
                <td className="p-2"><Input className="w-24 text-right" type="number" min="0" step="any" value={ex.quantity??''} onChange={e=>changeExtra(ex.id,{quantity:number(e.target.value)})}/></td>
                <td className="p-2"><Input className="w-28 text-right" type="number" min="0" step="any" value={ex.unitPrice??''} onChange={e=>changeExtra(ex.id,{unitPrice:number(e.target.value)})}/></td>
                <td className="p-2"><Input className="w-28 text-right" type="number" min="0" step="any" value={ex.lumpAmount??''} onChange={e=>changeExtra(ex.id,{lumpAmount:number(e.target.value)})}/></td>
                <td><Button size="icon" variant="ghost" aria-label="Ek işi sil" onClick={()=>setExtras(p=>p.filter(x=>x.id!==ex.id))}><Trash2 className="h-4 w-4"/></Button></td>
              </tr>)}</tbody>
            </table></div>
            {analysis && <div className="p-3 border-t grid sm:grid-cols-2 gap-2 text-sm">
              <span>Önceki hakedişlerdeki ek işler: <b>{fmt(analysis.previousExtraNet)}</b></span>
              <span>Yeni ek işler: <b>{fmt(analysis.newExtraNet)}</b></span>
            </div>}
          </section>
          <section className="rounded-lg border bg-card p-4"><Label>Açıklama</Label><Textarea rows={2} value={description} onChange={e=>setDescription(e.target.value)} /></section>
        </>}
      </div>
      <aside className="space-y-3 lg:sticky lg:top-20 self-start">
        <section className="rounded-lg border bg-card p-4 space-y-3"><h2 className="font-semibold">Kesin Hesap Özeti</h2>
          {analysis ? <>
            <div className="text-sm space-y-2">
              <div className="flex justify-between"><span>Nihai üretim (ek işler dahil)</span><b>{fmt(analysis.finalNet)}</b></div>
              <div className="flex justify-between"><span>Önceki onaylı tahakkuk</span><b>−{fmt(analysis.offsetNet)}</b></div>
              <div className="flex justify-between border-t pt-2"><span>Bu kesin hesabın dönem tahakkuku</span><b>{fmt(analysis.periodNet)}</b></div>
              <div className="flex justify-between"><span>Önceki kayıtlı ödemeler</span><b>−{fmt(analysis.paidNet)}</b></div>
              <div className="flex justify-between border-t pt-2"><span>Toplam kalan ödeme</span><b>{analysis.remainingNet===null?'Doğrulanamıyor':fmt(analysis.remainingNet)}</b></div>
              <div className="text-xs text-muted-foreground">Rakamlar KDV hariçtir. Ödemeler sistemde kayıtlı tutarlardır, banka mutabakatı değildir.</div>
            </div>
            {analysis.errors.map((e,i)=><div key={i} className="text-xs text-destructive flex gap-1"><AlertTriangle className="h-4 w-4 shrink-0"/>{e}</div>)}
            {analysis.warnings.map((e,i)=><p key={i} className="text-xs text-amber-700">{e}</p>)}
            <Button className="w-full" disabled={!analysis.data||saving} onClick={save}>{saving?'Kaydediliyor…':'Kesin hesabı kaydet'}</Button>
          </>:<p className="text-sm text-muted-foreground">Proje, altyüklenici ve anlaşma seçiniz.</p>}
        </section>
      </aside>
    </div>
  </div></MainLayout>;
}
