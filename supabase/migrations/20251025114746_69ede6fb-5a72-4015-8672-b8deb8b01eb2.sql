-- Create function to update timestamps if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add cost field to pieces table
ALTER TABLE public.pieces ADD COLUMN cost numeric;

-- Create mining_products table
CREATE TABLE public.mining_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT,
  acquisition_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cost NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on mining_products
ALTER TABLE public.mining_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mining_products
CREATE POLICY "Users can view own mining products"
ON public.mining_products
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own mining products"
ON public.mining_products
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own mining products"
ON public.mining_products
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own mining products"
ON public.mining_products
FOR DELETE
USING (auth.uid() = user_id);

-- Create financial_transactions table
CREATE TABLE public.financial_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  transaction_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on financial_transactions
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for financial_transactions
CREATE POLICY "Users can view own transactions"
ON public.financial_transactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
ON public.financial_transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
ON public.financial_transactions
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
ON public.financial_transactions
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for mining_products updated_at
CREATE TRIGGER update_mining_products_updated_at
BEFORE UPDATE ON public.mining_products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();