-- Add custom_author column to marketing_posts table
ALTER TABLE marketing_posts 
ADD COLUMN IF NOT EXISTS custom_author text;

-- Comment on column
COMMENT ON COLUMN marketing_posts.custom_author IS 'Overrides the linked user display name if set';
