ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS price_basis text;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS value_status text;
ALTER TABLE public.hakedisler ADD COLUMN IF NOT EXISTS plan_links jsonb;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_price_basis_chk CHECK (price_basis IS NULL OR price_basis IN ('kdv_haric','kdv_dahil')) NOT VALID;
ALTER TABLE public.contracts ADD CONSTRAINT contracts_value_status_chk CHECK (value_status IS NULL OR value_status IN ('kesin','tahmini_tam','tahmini_kismi','yalniz_birim_fiyat')) NOT VALID;
ALTER TABLE public.hakedisler ADD CONSTRAINT hakedisler_plan_links_chk CHECK (plan_links IS NULL OR jsonb_typeof(plan_links) = 'array') NOT VALID;
COMMENT ON COLUMN public.contracts.price_basis IS 'Anlaşma fiyatlarının giriş esası. Saklanan tutarlar her zaman KDV hariçtir. NULL = eski kayıt, bilinmiyor.';
COMMENT ON COLUMN public.contracts.value_status IS 'Beyan edilen bedel niteliği. NULL = kayıttan hesapla. Uygulama, kayıtla çelişen kesin beyanını yok sayar.';
COMMENT ON COLUMN public.hakedisler.plan_links IS 'Götürü ödeme aşaması bağlantıları [{planItemId, amount(KDV hariç)}]. Revize hakedişler toplamlara katılmaz. NULL = bağlantı yok.';