-- Create storage bucket for Prostoral attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('prostoral-attachments', 'prostoral-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'prostoral-attachments');

-- Policy to allow authenticated users to view files
CREATE POLICY "Authenticated users can view attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'prostoral-attachments');

-- Policy to allow authenticated users to delete their own files (optional, good to have)
CREATE POLICY "Authenticated users can delete attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'prostoral-attachments');
