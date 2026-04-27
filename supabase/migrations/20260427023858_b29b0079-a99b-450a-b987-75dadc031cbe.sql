CREATE TABLE public.app_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view app updates"
  ON public.app_updates FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert app updates"
  ON public.app_updates FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update app updates"
  ON public.app_updates FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete app updates"
  ON public.app_updates FOR DELETE
  USING (true);

CREATE INDEX idx_app_updates_created_at ON public.app_updates(created_at DESC);