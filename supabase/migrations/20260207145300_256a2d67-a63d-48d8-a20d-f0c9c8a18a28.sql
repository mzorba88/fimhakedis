-- Projeler tablosu
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_name TEXT NOT NULL,
  project_code TEXT NOT NULL,
  location TEXT NOT NULL,
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'tamamlandi')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sözleşmeler tablosu (Work Entries / Contracts)
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_no TEXT NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  work_category TEXT NOT NULL,
  subcontractor TEXT NOT NULL,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('goturu_bedel', 'birim_fiyat')),
  contract_file TEXT,
  description TEXT,
  date DATE NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY' CHECK (currency IN ('TRY', 'USD', 'EUR', 'GBP')),
  vat_rate NUMERIC,
  payment_plan JSONB,
  work_item_entries JSONB,
  created_by TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'onay_bekliyor' CHECK (approval_status IN ('onay_bekliyor', 'onaylandi', 'revize')),
  approved_by TEXT,
  approval_date TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'odenmedi' CHECK (payment_status IN ('odendi', 'odenmedi')),
  paid_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Hakedişler tablosu (Subcontractor Progress Payments)
CREATE TABLE public.hakedisler (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hakedis_no TEXT NOT NULL UNIQUE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subcontractor TEXT NOT NULL,
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  contract_no TEXT NOT NULL,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('goturu_bedel', 'birim_fiyat')),
  currency TEXT NOT NULL DEFAULT 'TRY' CHECK (currency IN ('TRY', 'USD', 'EUR', 'GBP')),
  vat_rate NUMERIC,
  date DATE NOT NULL,
  description TEXT,
  payment_amount NUMERIC,
  hakedis_items JSONB,
  extra_items JSONB,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'onay_bekliyor' CHECK (approval_status IN ('onay_bekliyor', 'onaylandi', 'revize')),
  approved_by TEXT,
  approval_date TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  payment_status TEXT NOT NULL DEFAULT 'odenmedi' CHECK (payment_status IN ('odendi', 'odenmedi')),
  paid_date TIMESTAMP WITH TIME ZONE,
  contract_exceeded_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Taşeronlar tablosu
CREATE TABLE public.subcontractors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- İşlem geçmişi tablosu
CREATE TABLE public.activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  user_role TEXT NOT NULL,
  description TEXT NOT NULL,
  details TEXT,
  entity_id TEXT,
  entity_type TEXT CHECK (entity_type IN ('project', 'contract', 'hakedis')),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sözleşme numarası sayacı
CREATE TABLE public.counters (
  id TEXT PRIMARY KEY,
  value INTEGER NOT NULL DEFAULT 1000
);

-- Sayaç başlangıç değerleri
INSERT INTO public.counters (id, value) VALUES ('contract', 1005), ('hakedis', 1000);

-- RLS etkinleştir - Herkes okuyabilir ve yazabilir (rol tabanlı uygulama)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hakedisler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counters ENABLE ROW LEVEL SECURITY;

-- Public erişim politikaları (uygulama kendi şifre korumasını kullanıyor)
CREATE POLICY "Allow all access to projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to contracts" ON public.contracts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to hakedisler" ON public.hakedisler FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to subcontractors" ON public.subcontractors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to counters" ON public.counters FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger fonksiyonu
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ları ekle
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_hakedisler_updated_at BEFORE UPDATE ON public.hakedisler FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();