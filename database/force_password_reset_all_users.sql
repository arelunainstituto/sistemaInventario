-- Force password reset for ALL existing users
-- This script updates the user metadata to ensure everyone must change their password on next login.

UPDATE auth.users
SET raw_user_meta_data = 
  COALESCE(raw_user_meta_data, '{}'::jsonb) || 
  '{"must_change_password": true, "last_password_change": null}'::jsonb;
