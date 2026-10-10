-- TASLAK — canlı Supabase üzerinde henüz UYGULANMADI.
-- Eski alelhesaplar NULL kalır; otomatik sınıflandırma yapılmaz.
ALTER TABLE public.hakedisler
  ADD COLUMN IF NOT EXISTS alelhesap_nature text NULL
  CONSTRAINT hakedisler_alelhesap_nature_check CHECK (alelhesap_nature IN ('avans', 'tahakkuk'));
-- Geri alma (yalnızca önceden bu sütun yoksa ve yeni veriler güvenle taşındıysa):
-- ALTER TABLE public.hakedisler DROP COLUMN alelhesap_nature;
-- Not: Mevcut RLS herkese açıktır. Bu migration yetkilendirme sorununu çözmez.
