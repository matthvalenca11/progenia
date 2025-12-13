-- Create storage bucket for lab videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('lab-videos', 'lab-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy for lab video uploads (admin only)
CREATE POLICY "Admins can upload lab videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'lab-videos' 
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create policy for public read access
CREATE POLICY "Lab videos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'lab-videos');

-- Create policy for admin delete
CREATE POLICY "Admins can delete lab videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'lab-videos'
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);