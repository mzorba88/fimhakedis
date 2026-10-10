-- TASLAK — UYGULANMADI. Kullanıcı onayı olmadan çalıştırılmamalıdır.
-- Tümü ekleme niteliğinde; mevcut kolonlara/verilere dokunmaz. Eski kayıtlar NULL kalır (= "bilinmiyor").

ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS price_basis text
    CHECK (price_basis IN ('kdv_haric','kdv_dahil')),          -- NULL = eski kayıt, esas bilinmiyor
  ADD COLUMN IF NOT EXISTS value_status text
    CHECK (value_status IN ('kesin','tahmini_tam','tahmini_kismi','yalniz_birim_fiyat'));  -- NULL = kayıttan hesapla

COMMENT ON COLUMN public.contracts.price_basis IS 'Anlaşma fiyatlarının giriş esası. Saklanan tutarlar her zaman KDV hariçtir.';
COMMENT ON COLUMN public.contracts.value_status IS 'Bedelin niteliği; birim fiyatta kullanıcı "kesin bedel" beyan edebilsin diye.';

-- Aşama 4 (hakediş ↔ aşama/kalem bağlantısı; çoktan-çoğa, kısmi bağlama destekli):
ALTER TABLE public.hakedisler
  ADD COLUMN IF NOT EXISTS plan_links jsonb;  -- [{ "planItemId": "pi_…", "amount": 1234.5 }]
-- Birim fiyat kalemleri zaten hakedis_items[].workItemEntryId ile bağlanıyor ve fiyat kopyası hakedişte duruyor.
-- Kalem/aşama kimlikleri JSON içinde kalıcı (wie_<uuid>, pi_<uuid>); ayrı tablo bu aşamada gerekli değil.
