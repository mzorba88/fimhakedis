-- Add paid_amount column to track partial payments
ALTER TABLE public.hakedisler ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;