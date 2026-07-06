-- ==============================================================================
-- ANCHOR FASHION — STORAGE BUCKETS (MIGRATION 0008)
-- ==============================================================================

-- Create a public bucket for employee avatars and KYC photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
-- Allow anyone to read avatars
CREATE POLICY "Avatar images are publicly accessible." 
ON storage.objects FOR SELECT USING ( bucket_id = 'avatars' );

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload their own avatars." 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = owner );

-- Allow users to update their own avatar
CREATE POLICY "Users can update their own avatars." 
ON storage.objects FOR UPDATE 
WITH CHECK ( bucket_id = 'avatars' AND auth.uid() = owner );
