-- Create table for expenses tracking
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  
  -- Expense type: 'order' (from Excel), 'manual' (user-added), 'installment' (printer/filament payments)
  expense_type text NOT NULL DEFAULT 'manual',
  
  -- Order-related fields (from Excel)
  platform_order_id text,
  internal_order_id text,
  platform text,
  store_name text,
  order_status text,
  order_date timestamp with time zone,
  payment_date timestamp with time zone,
  shipping_deadline timestamp with time zone,
  
  -- Financial data
  order_value numeric,
  product_value numeric,
  discounts numeric,
  commission numeric,
  buyer_shipping numeric,
  total_shipping numeric,
  estimated_profit numeric,
  
  -- Product details
  product_name text,
  sku text,
  variation text,
  image_url text,
  product_price numeric,
  quantity integer DEFAULT 1,
  
  -- Manual expense fields
  description text,
  category text,
  amount numeric,
  notes text,
  
  -- Metadata
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own expenses"
  ON public.expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own expenses"
  ON public.expenses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON public.expenses FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX idx_expenses_platform_order_id ON public.expenses(platform_order_id);
CREATE INDEX idx_expenses_expense_type ON public.expenses(expense_type);

-- Add updated_at trigger
CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();