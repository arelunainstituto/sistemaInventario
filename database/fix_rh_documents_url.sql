-- Fix rh_documents table to allow NULL url
-- Since we now use signed URLs generated on-demand, the url field can be null

ALTER TABLE rh_documents 
ALTER COLUMN url DROP NOT NULL;

-- Confirmation
SELECT 'Column url in rh_documents now allows NULL values' as status;
