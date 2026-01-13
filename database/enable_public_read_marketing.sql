-- Enable Row Level Security (RLS) on the table
ALTER TABLE marketing_posts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access (using Anon Key)
-- Only allows reading posts that are 'published'
CREATE POLICY "Public Read Access for Published Posts"
ON marketing_posts
FOR SELECT
TO anon, authenticated  -- Allows both anon (public) and authenticated users to read
USING (status = 'published');

-- Note: Admin/Marketing write access policies should also be ensured if RLS is enabled.
-- If you haven't defined write policies yet, enabling RLS might block your Admin panel writers!

-- Policy for Writers (Admins and Marketing) to do everything
CREATE POLICY "Full Access for Marketing and Admins"
ON marketing_posts
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
    AND (r.name = 'Admin' OR r.name = 'Marketing')
  )
);
