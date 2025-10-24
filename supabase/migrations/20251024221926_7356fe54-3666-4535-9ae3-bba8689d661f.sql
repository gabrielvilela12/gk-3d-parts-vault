-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create pieces table
CREATE TABLE public.pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  width NUMERIC,
  height NUMERIC,
  depth NUMERIC,
  material TEXT,
  stl_url TEXT,
  image_url TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.pieces ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for pieces
CREATE POLICY "Anyone can view pieces"
  ON public.pieces FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert pieces"
  ON public.pieces FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pieces"
  ON public.pieces FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pieces"
  ON public.pieces FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for user_roles
CREATE POLICY "Anyone can view roles"
  ON public.user_roles FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Create storage bucket for STL files
INSERT INTO storage.buckets (id, name, public)
VALUES ('stl-files', 'stl-files', true);

-- Storage policies for STL files
CREATE POLICY "Anyone can view STL files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'stl-files');

CREATE POLICY "Authenticated users can upload STL files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'stl-files' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own STL files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'stl-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own STL files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'stl-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Create storage bucket for piece images
INSERT INTO storage.buckets (id, name, public)
VALUES ('piece-images', 'piece-images', true);

-- Storage policies for piece images
CREATE POLICY "Anyone can view piece images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'piece-images');

CREATE POLICY "Authenticated users can upload piece images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'piece-images' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own piece images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'piece-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own piece images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'piece-images' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  
  -- Give first user admin role
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();