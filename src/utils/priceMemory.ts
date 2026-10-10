/**
 * Birim Fiyat Hafızası (Aşama 1C) — mevcut verilerden DİNAMİK hesaplanır.
 * Hiçbir kaydı değiştirmez; yalnızca okur ve öneri üretir.
 *
 * Kaynaklar:
 *  - contracts.work_item_entries (birim fiyat sözleşmeleri — "anlaşma fiyatı")
 *  - hakedisler.hakedis_items (yalnızca ONAYLI hakedişler — "kullanılmış fiyat")
 *
 * Eşleştirme anahtarı: altyüklenici + normalize açıklama + teknik ölçü (örn. 60x60)
 * + birim + para birimi. Genel kategoriye göre eşleştirme YAPILMAZ.
 */
import type { Currency, SubcontractorHakedis, WorkEntry } from '@/types/hakedis';
import { foldTr } from '@/lib/utils';

export type PriceBasis = 'kdv_haric' | 'kdv_dahil' | 'bilinmiyor';

export interface PriceObservation {
  subcontractor: string;
  projectId: string;
  description: string;
  workCategory?: string;
  unit: string;
  unitPrice: number;
  currency: Currency;
  priceBasis: PriceBasis;
  date: string;
  source: 'sozlesme' | 'hakedis';
  sourceNo: string;
  sourceId: string;
  approved: boolean;
  /** Varsayılan öneriye kaynak olabilir mi (onaylı + fiyat esası belirsiz değil) */
  reliable: boolean;
  matchKey: string;
}

const UNIT_ALIASES: Record<string, string> = {
  m2: 'm2', 'm²': 'm2', mt2: 'm2', metrekare: 'm2',
  m3: 'm3', 'm³': 'm3', mt3: 'm3', metrekup: 'm3',
  m: 'm', mt: 'm', metre: 'm', mtul: 'mtul', 'm.tul': 'mtul',
  kg: 'kg', kilogram: 'kg', ton: 'ton', tn: 'ton',
  adet: 'adet', ad: 'adet', pcs: 'adet', ea: 'adet',
  gun: 'gun', saat: 'saat', sefer: 'sefer', takim: 'takim', set: 'takim', goturu: 'goturu', ls: 'goturu',
};

export function normalizeUnit(u?: string): string {
  const k = foldTr(u || '').replace(/\s+/g, '').replace(/[^a-z0-9.²³]/g, '');
  return UNIT_ALIASES[k] || k;
}

/** Teknik ölçüleri (60x60, 1,5 cm, Ø12 vb.) korur, diğer noktalama ve boşlukları sadeleştirir. */
export function normalizeDescription(d?: string): string {
  return foldTr(d || '')
    .replace(/\[[^\]]*\]/g, ' ')            // [Etiket] kaldır
    .replace(/(\d)\s*[x×*]\s*(\d)/g, '$1x$2') // 60 x 60 → 60x60
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[^a-z0-9.x ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchKey(subcontractor: string, description: string, unit: string, currency: string) {
  return [foldTr(subcontractor).trim(), normalizeDescription(description), normalizeUnit(unit), currency].join('|');
}

export function collectPriceObservations(
  contracts: WorkEntry[],
  hakedisler: SubcontractorHakedis[]
): PriceObservation[] {
  const out: PriceObservation[] = [];
  contracts
    .filter((c) => c.contractType === 'birim_fiyat')
    .forEach((c) => {
      (c.workItemEntries || []).forEach((w) => {
        if (!w.unitPrice || !w.description) return;
        const currency = (w.currency || c.currency) as Currency;
        const approved = c.approvalStatus === 'onaylandi';
        out.push({
          subcontractor: c.subcontractor, projectId: c.projectId, description: w.description,
          workCategory: w.workCategory || c.workCategory, unit: w.unit, unitPrice: w.unitPrice, currency,
          // Mevcut veride fiyat esası saklanmıyor; form KDV hariç birim fiyat yazıyor
          priceBasis: 'kdv_haric', date: c.date, source: 'sozlesme', sourceNo: c.contractNo, sourceId: c.id,
          approved, reliable: approved, matchKey: matchKey(c.subcontractor, w.description, w.unit, currency),
        });
      });
    });
  hakedisler.forEach((h) => {
    (h.hakedisItems || []).forEach((it) => {
      if (!it.unitPrice || !it.description) return;
      const approved = h.approvalStatus === 'onaylandi';
      out.push({
        subcontractor: h.subcontractor, projectId: h.projectId || '', description: it.description,
        workCategory: it.workCategory, unit: it.unit, unitPrice: it.unitPrice, currency: h.currency,
        priceBasis: 'kdv_haric', date: h.approvalDate || h.date, source: 'hakedis', sourceNo: h.hakedisNo,
        sourceId: h.id, approved, reliable: approved,
        matchKey: matchKey(h.subcontractor, it.description, it.unit, h.currency),
      });
    });
  });
  return out;
}

export type SuggestionTier = 'proje_ozel' | 'altyuklenici_son' | 'diger_kaynak' | 'manuel';

export interface PriceSuggestion {
  tier: SuggestionTier;
  /** Varsayılan önerilen fiyat; 'diger_kaynak' ve 'manuel'de null — kullanıcı seçer/girer */
  suggested: PriceObservation | null;
  /** Kullanıcıya kaynağıyla birlikte sunulacak alternatifler (en yeni önce) */
  alternatives: PriceObservation[];
  /** Aynı anahtar için tarih sıralı fiyat tarihçesi */
  history: PriceObservation[];
}

const byDateDesc = (a: PriceObservation, b: PriceObservation) =>
  (b.date || '').localeCompare(a.date || '') || (a.source === 'hakedis' ? -1 : 1);

/**
 * Öncelik:
 *  1) Aynı proje + aynı altyüklenici + aynı iş için son onaylı fiyat (proje özel)
 *  2) Aynı altyüklenicinin aynı iş için son onaylı fiyatı (herhangi bir proje)
 *  3) Diğer altyüklenicilerin aynı iş/birim/para birimi fiyatları — yalnızca seçenek
 *  4) Eşleşme yoksa manuel giriş
 */
export function suggestUnitPrice(
  query: { subcontractor: string; projectId?: string; description: string; unit: string; currency: Currency },
  observations: PriceObservation[]
): PriceSuggestion {
  const key = matchKey(query.subcontractor, query.description, query.unit, query.currency);
  const same = observations.filter((o) => o.matchKey === key).sort(byDateDesc);
  const reliable = same.filter((o) => o.reliable);

  const projectSpecific = query.projectId ? reliable.filter((o) => o.projectId === query.projectId) : [];
  if (projectSpecific.length)
    return { tier: 'proje_ozel', suggested: projectSpecific[0], alternatives: reliable.filter((o) => o !== projectSpecific[0]), history: same };
  if (reliable.length)
    return { tier: 'altyuklenici_son', suggested: reliable[0], alternatives: reliable.slice(1), history: same };

  const otherKeySuffix = key.split('|').slice(1).join('|');
  const others = observations
    .filter((o) => o.reliable && o.matchKey.split('|').slice(1).join('|') === otherKeySuffix)
    .sort(byDateDesc);
  if (others.length) return { tier: 'diger_kaynak', suggested: null, alternatives: others, history: same };
  return { tier: 'manuel', suggested: null, alternatives: [], history: same };
}

/**
 * Fiyat değişikliği: yeni fiyat yalnızca yeni kayda uygulanır; geçmiş metraj kendi fiyatıyla kalır.
 * Dönemlere bölünmüş imalat tutarı = Σ (her dönemin miktarı × o dönemin fiyatı).
 */
export function priceSegments(segments: { quantity: number; unitPrice: number }[]): number {
  return segments.reduce((s, x) => s + (x.quantity || 0) * (x.unitPrice || 0), 0);
}
