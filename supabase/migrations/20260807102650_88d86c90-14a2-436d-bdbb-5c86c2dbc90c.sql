ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS execution_status text NOT NULL DEFAULT 'error',
  ADD COLUMN IF NOT EXISTS output_matched boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS output_match_reason text;