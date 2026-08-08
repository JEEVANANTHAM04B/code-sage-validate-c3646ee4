DROP POLICY IF EXISTS "Anyone can create submissions" ON public.submissions;
DROP POLICY IF EXISTS "Anyone can view submissions" ON public.submissions;

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.submissions FROM anon;
REVOKE ALL ON public.submissions FROM authenticated;
GRANT ALL ON public.submissions TO service_role;