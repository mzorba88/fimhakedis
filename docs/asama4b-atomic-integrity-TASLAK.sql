-- AŞAMA 4B — TASLAK; CANLI VERİTABANINDA ÇALIŞTIRILMADI.
-- Önkoşullar: yedek + geri dönüş denemesi, izole staging doğrulaması, kullanıcı onayı.
-- Veritabanı: public.contracts / public.hakedisler.
-- UYARI: Bu kurallar kayıt bütünlüğü içindir. Mevcut herkese açık RLS'yi düzeltmez.
-- Canlı uygulamaya geçiş aynı dağıtım penceresinde yapılmalı.
BEGIN;

-- 1. Eski alelhesap kayıtları bilinmiyor (NULL) kalır.
ALTER TABLE public.hakedisler ADD COLUMN IF NOT EXISTS alelhesap_nature text;
ALTER TABLE public.hakedisler
  ADD CONSTRAINT fim_4b_alel_nature_ck
  CHECK (alelhesap_nature IS NULL OR alelhesap_nature IN ('avans','tahakkuk')) NOT VALID;

-- 2. Aynı anlaşmaya iki aktif kesin hesap, eşzamanlı yazılsa bile mümkün olmasın.
-- NOT: Ön kontrol: SELECT contract_id, count(*) FROM public.hakedisler
-- WHERE contract_id IS NOT NULL AND hakedis_type='kesin_hesap'
-- AND approval_status <> 'revize' GROUP BY contract_id HAVING count(*) > 1;
CREATE UNIQUE INDEX fim_4b_one_final_per_contract
  ON public.hakedisler(contract_id)
  WHERE contract_id IS NOT NULL
    AND hakedis_type='kesin_hesap' AND approval_status <> 'revize';

-- 3. Aşama rezervasyonunu aynı anlaşma satırını kilitleyerek seri hale getir.
CREATE FUNCTION public.fim_4b_guard_hakedis() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_plan jsonb;
  v_link jsonb;
  v_stage_id text;
  v_link_amount numeric;
  v_planned numeric;
  v_used numeric;
  v_seen text[] := ARRAY[]::text[];
BEGIN
  IF NEW.hakedis_type = 'alelhesap' AND NEW.alelhesap_nature IS NULL
     AND TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Yeni alelhesapta avans/tahakkuk seçimi zorunludur';
  END IF;
  IF NEW.hakedis_type <> 'alelhesap' AND NEW.alelhesap_nature IS NOT NULL THEN
    RAISE EXCEPTION 'alelhesap_nature yalnızca alelhesap kayıtlarında kullanılır';
  END IF;

  -- Eski form, bağlı aşamaların mali satırlarını ve tutarını bağlantıdan
  -- bağımsız şekilde değiştiremez. Düzeltme ayrı kontrollü iş akışı gerektirir.
  IF TG_OP = 'UPDATE' AND jsonb_typeof(OLD.plan_links) = 'array'
    AND jsonb_array_length(OLD.plan_links) > 0
    AND (
      NEW.total_amount IS DISTINCT FROM OLD.total_amount OR
      NEW.plan_links IS DISTINCT FROM OLD.plan_links OR
      NEW.extra_items IS DISTINCT FROM OLD.extra_items OR
      NEW.hakedis_items IS DISTINCT FROM OLD.hakedis_items OR
      NEW.payment_amount IS DISTINCT FROM OLD.payment_amount OR
      NEW.contract_id IS DISTINCT FROM OLD.contract_id OR
      NEW.currency IS DISTINCT FROM OLD.currency OR
      NEW.hakedis_type IS DISTINCT FROM OLD.hakedis_type
    ) THEN
    RAISE EXCEPTION 'Aşamaya bağlı hakedişin mali bilgileri eski formdan düzenlenemez';
  END IF;

  IF NEW.plan_links IS NULL OR NEW.plan_links = '[]'::jsonb THEN
    RETURN NEW;
  END IF;
  IF jsonb_typeof(NEW.plan_links) <> 'array' OR NEW.contract_id IS NULL THEN
    RAISE EXCEPTION 'Aşama bağlantısı geçerli anlaşmaya ait JSON dizisi olmalı';
  END IF;
  IF NEW.hakedis_type <> 'ara_hakedis' OR NEW.contract_type <> 'goturu_bedel' THEN
    RAISE EXCEPTION 'Aşama bağlantıları yalnızca götürü ara hakedişlerde geçerlidir';
  END IF;

  -- FOR UPDATE: aynı contract_id için paralel INSERT/UPDATE'leri sıraya alır.
  SELECT c.payment_plan INTO v_plan
  FROM public.contracts c WHERE c.id = NEW.contract_id FOR UPDATE;
  IF NOT FOUND OR jsonb_typeof(v_plan) <> 'array' THEN
    RAISE EXCEPTION 'Götürü anlaşma / ödeme aşamaları bulunamadı';
  END IF;

  FOR v_link IN SELECT value FROM jsonb_array_elements(NEW.plan_links) LOOP
    IF jsonb_typeof(v_link) <> 'object'
       OR jsonb_typeof(v_link->'planItemId') <> 'string'
       OR jsonb_typeof(v_link->'amount') <> 'number' THEN
      RAISE EXCEPTION 'Aşama bağlantısının kimliği ve tutarı geçersiz';
    END IF;
    v_stage_id := v_link->>'planItemId';
    v_link_amount := (v_link->>'amount')::numeric;
    IF v_stage_id = '' OR v_link_amount <= 0
       OR v_stage_id = ANY(v_seen) THEN
      RAISE EXCEPTION 'Boş, yinelenen veya sıfır aşama bağlantısı';
    END IF;
    v_seen := array_append(v_seen, v_stage_id);

    SELECT (p.value->>'amount')::numeric INTO v_planned
    FROM jsonb_array_elements(v_plan) AS p(value)
    WHERE p.value->>'id' = v_stage_id;
    IF NOT FOUND OR v_planned IS NULL OR v_planned < 0 THEN
      RAISE EXCEPTION 'Ödeme planında geçerli aşama yok: %', v_stage_id;
    END IF;

    SELECT COALESCE(SUM((l.value->>'amount')::numeric),0) INTO v_used
    FROM public.hakedisler h
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(h.plan_links)='array'
           THEN h.plan_links ELSE '[]'::jsonb END
    ) AS l(value)
    WHERE h.contract_id = NEW.contract_id
      AND h.id IS DISTINCT FROM NEW.id
      AND h.approval_status <> 'revize'
      AND l.value->>'planItemId' = v_stage_id;

    IF NEW.approval_status <> 'revize'
       AND v_used + v_link_amount > v_planned + 0.01 THEN
      RAISE EXCEPTION 'Aşama tutarı aşılıyor: %, plan %, kullanılan %, yeni %',
        v_stage_id, v_planned, v_used, v_link_amount;
    END IF;
  END LOOP;
  RETURN NEW;
END
$$;

CREATE TRIGGER fim_4b_guard_hakedis_trg
BEFORE INSERT OR UPDATE OF
  contract_id, currency, contract_type, hakedis_type,
  approval_status, plan_links, total_amount, hakedis_items,
  extra_items, payment_amount, alelhesap_nature
ON public.hakedisler
FOR EACH ROW EXECUTE FUNCTION public.fim_4b_guard_hakedis();

-- 4. Bağlı aşama rezervasyonu varken ödeme planı sessizce değiştirilmesin.
CREATE FUNCTION public.fim_4b_guard_contract_plan() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.payment_plan IS DISTINCT FROM OLD.payment_plan
     AND EXISTS (
       SELECT 1 FROM public.hakedisler h
       WHERE h.contract_id = OLD.id
         AND h.approval_status <> 'revize'
         AND jsonb_typeof(h.plan_links)='array'
         AND jsonb_array_length(h.plan_links)>0
     ) THEN
    RAISE EXCEPTION 'Bağlı hakediş bulunan anlaşmanın ödeme planı doğrudan değiştirilemez';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER fim_4b_guard_contract_plan_trg
BEFORE UPDATE OF payment_plan ON public.contracts
FOR EACH ROW EXECUTE FUNCTION public.fim_4b_guard_contract_plan();

COMMIT;

-- Entegrasyon testleri STAGING DB'de:
-- A) Aynı aşama için iki eşzamanlı transaction, toplam>plan: yalnız biri geçmeli.
-- B) Onay bekleyen hakediş aynı aşamayı rezerve etmeli; revize serbest bırakmalı.
-- C) Aşama bağlantılı kaydın eski formdan total_amount ve plan_links değişimi reddedilmeli.
-- D) payment_plan değişimi bağlantı varken reddedilmeli.
-- E) Aynı contract_id ile iki aktif kesin hesap paralel oluşamamalı.
-- F) Yeni alelhesap NULL türle reddedilmeli, eski NULL alelhesaplar değişmemeli.
-- G) Yanlış kategori / para birimi vb. için ayrı mutabakat kontrolleri gereklidir.
-- DİKKAT: Public RLS mevcut haliyle bütün kullanıcılara DELETE izni veriyor;
-- trigger bunu çözmez. Prod'a çıkmadan önce yetkiler MUTLAKA düzeltilmeli.
