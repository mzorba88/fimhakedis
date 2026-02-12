ALTER TABLE public.hakedisler DROP CONSTRAINT hakedisler_payment_status_check;

ALTER TABLE public.hakedisler ADD CONSTRAINT hakedisler_payment_status_check 
  CHECK (payment_status IN ('odendi', 'odenmedi', 'kismen_odendi'));