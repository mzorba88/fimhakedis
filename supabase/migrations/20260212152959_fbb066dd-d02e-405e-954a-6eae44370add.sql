-- Add hakedis_type column to hakedisler table
-- Values: 'ara_hakedis' (normal/interim), 'alelhesap' (payment on account), 'kesin_hesap' (final account)
ALTER TABLE public.hakedisler 
ADD COLUMN hakedis_type text NOT NULL DEFAULT 'ara_hakedis';
