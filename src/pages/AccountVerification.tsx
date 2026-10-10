import { useMemo, useState } from 'react';
import { MainLayout } from '@/components/MainLayout';
import { useHakedisStore } from '@/store/hakedisStore';
import { compareOldNew } from '@/utils/hakedisCalculations';
import { formatCurrencyWithType } from '@/types/hakedis';
import { foldTr } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

const basisLabels: Record<string, string> = {
  donem: 'Dönem',
  tek_seferlik: 'Tek seferlik',
  kumulatif: 'Kümülatif',
  belirsiz: 'Belirsiz',
};

/** Salt okunur: eski ve yeni cari hesap hesaplamalarını karşılaştırır. Hiçbir kayıt değiştirilmez. */
export default function AccountVerification() {
  const { subcontractorHakedisler, workEntries, projects } = useHakedisStore();
  const [q, setQ] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(true);

  const rows = useMemo(() => compareOldNew(subcontractorHakedisler, workEntries), [subcontractorHakedisler, workEntries]);
  const projectLabel = (id: string) => {
    const p = projects.find((x) => x.id === id);
    return p ? `${p.projectCode} — ${p.projectName}` : 'Proje belirtilmemiş';
  };

  const filtered = rows
    .filter((r) => !onlyIssues || !r.reliable || Math.abs(r.difference) > 0.01)
    .filter((r) => !q || foldTr(`${r.subcontractor} ${projectLabel(r.projectId)}`).includes(foldTr(q)))
    .sort((a, b) => Number(a.reliable) - Number(b.reliable) || a.subcontractor.localeCompare(b.subcontractor, 'tr'));

  const issueCount = rows.filter((r) => !r.reliable).length;
  const diffCount = rows.filter((r) => Math.abs(r.difference) > 0.01).length;
  const f = (n: number, c: string) => formatCurrencyWithType(n, c as never);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="page-title flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> Cari Hesap Doğrulama</h1>
          <p className="page-subtitle">
            Salt okunur karşılaştırma. Eski ve yeni hesaplama farklarını gösterir; hiçbir kayıt değiştirilmez. Tutarlar KDV hariçtir.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="stat-card"><p className="text-sm text-muted-foreground">Dosya (altyüklenici + proje + para birimi)</p><p className="text-2xl font-semibold">{rows.length}</p></div>
          <div className="stat-card"><p className="text-sm text-muted-foreground">Manuel inceleme gereken dosya</p><p className="text-2xl font-semibold text-amber-600">{issueCount}</p></div>
          <div className="stat-card"><p className="text-sm text-muted-foreground">Kalan bakiyesi farklı çıkan dosya</p><p className="text-2xl font-semibold">{diffCount}</p></div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input placeholder="Altyüklenici veya proje ara..." value={q} onChange={(e) => setQ(e.target.value)} className="sm:max-w-sm" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
            Yalnızca farklı / şüpheli dosyalar
          </label>
        </div>

        <div className="card-elevated overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Altyüklenici / Proje</th>
                <th className="px-3 py-2 text-right">Eski: Onaylı Hakediş</th>
                <th className="px-3 py-2 text-right">Eski: Kalan</th>
                <th className="px-3 py-2 text-right">Yeni: Onaylı Dönem Tahakkuku</th>
                <th className="px-3 py-2 text-right">Kayıtlı Ödeme</th>
                <th className="px-3 py-2 text-right">Yeni: Kalan</th>
                <th className="px-3 py-2 text-right">Fark</th>
                <th className="px-3 py-2 text-left">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => (
                <tr key={r.key} className="align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium">{r.subcontractor}</p>
                    <p className="text-xs text-muted-foreground">{projectLabel(r.projectId)} · {r.currency}</p>
                    {r.pendingAmount > 0 && (
                      <p className="text-xs text-muted-foreground">Onay bekleyen/revize: {f(r.pendingAmount, r.currency)} (borç sayılmaz)</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{f(r.oldApproved, r.currency)}</td>
                  <td className="px-3 py-2 text-right">{f(r.oldRemaining, r.currency)}</td>
                  <td className="px-3 py-2 text-right">{f(r.newApprovedAccrual, r.currency)}</td>
                  <td className="px-3 py-2 text-right">{f(r.recordedPayment, r.currency)}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {r.reliable ? f(r.newRemaining, r.currency) : <span className="text-amber-600">Kesin değil</span>}
                  </td>
                  <td className={`px-3 py-2 text-right ${Math.abs(r.difference) > 0.01 ? 'font-semibold text-amber-700' : 'text-muted-foreground'}`}>
                    {r.reliable ? f(r.difference, r.currency) : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {r.reliable ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> Uyumlu</span>
                    ) : (
                      <div className="space-y-1">
                        {r.unresolved.map((u) => (
                          <div key={u.id} className="text-xs">
                            <span className="inline-flex items-center gap-1 font-medium text-amber-700">
                              <AlertTriangle className="h-3.5 w-3.5" /> {u.hakedisNo}
                            </span>{' '}
                            <Badge variant="outline" className="text-[10px]">{basisLabels[u.basis]}</Badge>
                            <p className="text-muted-foreground">{u.reasons.join('; ') || 'Giriş esası belirsiz'}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Gösterilecek dosya yok</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </MainLayout>
  );
}
