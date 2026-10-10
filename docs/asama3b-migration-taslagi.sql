-- UYGULANDI: 2026-10-10 (PROMPT_3D). Anahtarlar: src/config/schemaFeatures.ts (sözleşme alanları 3E ile açık; plan_links yazımı Aşama 4e kadar kapalı).
-- Yalnızca EKLEME: mevcut kolon/veri/politika değişmez. Eski kayıtlar NULL kalır (= "bilinmiyor / kayıttan hesapla").
-- Bu dosya izole PostgreSQL (PGlite) üzerinde doğrulandı: docs/asama3b-migration-dogrulama.mjs

BEGIN;

-- 1) Anlaşma düzeyi fiyat esası (ödeme planı olmayan götürü anlaşmalar dahil)
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS price_basis text;
-- 2) Beyan edilen bedel niteliği (birim fiyatta "kesin bedel" beyanı için)
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS value_status text;
-- 3) Hakediş ↔ götürü ödeme aşaması bağlantıları (çoktan-çoğa, kısmi)
--    [{ "planItemId": "pi_…", "amount": 1234.5 }]   amount KDV hariç
ALTER TABLE public.hakedisler
  ADD COLUMN IF NOT EXISTS plan_links jsonb;

-- Kısıtlar NOT VALID eklenir: mevcut satırlar taranmaz/kilitlenmez; NULL her zaman geçerli.
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_price_basis_chk
  CHECK (price_basis IS NULL OR price_basis IN ('kdv_haric','kdv_dahil')) NOT VALID;
ALTER TABLE public.contracts
  ADD CONSTRAINT contracts_value_status_chk
  CHECK (value_status IS NULL OR value_status IN ('kesin','tahmini_tam','tahmini_kismi','yalniz_birim_fiyat')) NOT VALID;
ALTER TABLE public.hakedisler
  ADD CONSTRAINT hakedisler_plan_links_chk
  CHECK (plan_links IS NULL OR jsonb_typeof(plan_links) = 'array') NOT VALID;

COMMENT ON COLUMN public.contracts.price_basis IS 'Anlaşma fiyatlarının giriş esası. Saklanan tutarlar her zaman KDV hariçtir. NULL = eski kayıt, bilinmiyor.';
COMMENT ON COLUMN public.contracts.value_status IS 'Beyan edilen bedel niteliği. NULL = kayıttan hesapla. Uygulama, kayıtla çelişen "kesin" beyanını yok sayar.';
COMMENT ON COLUMN public.hakedisler.plan_links IS 'Götürü ödeme aşaması bağlantıları [{planItemId, amount(KDV hariç)}]. Revize hakedişler toplamlara katılmaz. NULL = bağlantı yok.';

COMMIT;

-- Notlar
-- * Aşama/kalem kimlikleri contracts JSON içinde kalıcı (pi_<uuid>, wie_<uuid>); ayrı tablo gerekmiyor.
-- * Aşım/mükerrer tahakkuk kontrolü uygulamada (validatePlanLinks); veritabanı tetikleyicisi eklenmedi
--   çünkü aşama tutarları JSON içinde ve mevcut RLS herkese açık — gerçek sunucu kontrolü güvenlik
--   geçişinden (Auth + RLS) sonra değerlendirilmeli.
-- * RLS politikalarına DOKUNULMAZ; yeni kolonlar mevcut tablo politikalarını devralır.

-- GERİ DÖNÜŞ (yalnızca gerekirse; yeni kolonlara yazılmış veri kaybolur):
-- ALTER TABLE public.hakedisler DROP CONSTRAINT IF EXISTS hakedisler_plan_links_chk, DROP COLUMN IF EXISTS plan_links;
-- ALTER TABLE public.contracts DROP CONSTRAINT IF EXISTS contracts_value_status_chk, DROP CONSTRAINT IF EXISTS contracts_price_basis_chk,
--   DROP COLUMN IF EXISTS value_status, DROP COLUMN IF EXISTS price_basis;
