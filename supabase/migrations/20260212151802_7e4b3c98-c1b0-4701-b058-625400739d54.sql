
-- Add work_category column to subcontractors table
ALTER TABLE public.subcontractors ADD COLUMN work_category text;

-- Update existing subcontractors with their work categories
UPDATE public.subcontractors SET work_category = 'Seramik ve Mermer İşçilik' WHERE name = 'AHMET KURT';
UPDATE public.subcontractors SET work_category = 'Yapı İşleri' WHERE name = 'ALP KARDEŞLER';
UPDATE public.subcontractors SET work_category = 'Aluminyum ve Cam' WHERE name = 'ALUDENİZALP';
UPDATE public.subcontractors SET work_category = 'Mekanik Sıhhi Tesiat İşleri' WHERE name = 'ARİF MEŞE';
UPDATE public.subcontractors SET work_category = 'Elektrik İşleri' WHERE name = 'BARA ELEKTRİK';
UPDATE public.subcontractors SET work_category = 'Kuyu Kazı' WHERE name = 'CUMA KUYUCU USTA';
UPDATE public.subcontractors SET work_category = 'Ahşap' WHERE name = 'DEMİRBAĞ';
UPDATE public.subcontractors SET work_category = 'Boya ve Dekorasyon' WHERE name = 'EMSU BOYA';
UPDATE public.subcontractors SET work_category = 'Betonarme Demir İşçilik' WHERE name = 'HASAN KORUROĞLU';
UPDATE public.subcontractors SET work_category = 'Ahşap' WHERE name = 'HÜSEYİN USTA AHŞAP';
UPDATE public.subcontractors SET work_category = 'Dozer, Kazı ve Hafriyat' WHERE name = 'KARATAÇLAR';
UPDATE public.subcontractors SET work_category = 'Mekanik İşler' WHERE name = 'KOCAKAYA POOLS';
UPDATE public.subcontractors SET work_category = 'Ahşap' WHERE name = 'MASSA';
UPDATE public.subcontractors SET work_category = 'Mekanik İşler' WHERE name = 'MECHSYS';
UPDATE public.subcontractors SET work_category = 'Yapı İşleri' WHERE name = 'MEHMET SEZER';
UPDATE public.subcontractors SET work_category = 'Dozer, Kazı ve Hafriyat' WHERE name = 'MUSTAFA ŞÖFÖRLER';
UPDATE public.subcontractors SET work_category = 'Alçıpan' WHERE name = 'ÖNDER ALÇI DEKORASYON';
UPDATE public.subcontractors SET work_category = 'Aluminyum ve Cam' WHERE name = 'ÖZBİÇER ALUMİNYUM';
UPDATE public.subcontractors SET work_category = 'Laminant Parke' WHERE name = 'SERHAT USTA PARKE';
UPDATE public.subcontractors SET work_category = 'Kalıp İşleri' WHERE name = 'SERKAN ÖMERAĞA';
UPDATE public.subcontractors SET work_category = 'Boya ve Dekorasyon' WHERE name = 'ŞİFO USTA';
UPDATE public.subcontractors SET work_category = 'Altyapı' WHERE name = 'TAHİR SEVGİL';
UPDATE public.subcontractors SET work_category = 'Elektrik İşleri' WHERE name = 'TÜRKAY SILALI';
UPDATE public.subcontractors SET work_category = 'Çelik İşleri' WHERE name = 'YAŞAR SOYKAN';
