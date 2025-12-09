-- =====================================================
-- MASTER MIGRATION SCRIPT
-- Complete Employee Data System - Phase 1
-- =====================================================
-- Execute this script in Supabase SQL Editor
-- Or run individual scripts in order: 01, 02, 03, 04
-- =====================================================

\echo 'Starting Phase 1: Database Schema Expansion...'

-- 1. Add new fields to rh_employees table
\echo 'Step 1/4: Adding fields to rh_employees table...'
\i 01_add_employee_fields.sql

-- 2. Create emergency contacts table
\echo 'Step 2/4: Creating emergency contacts table...'
\i 02_create_emergency_contacts.sql

-- 3. Create payroll data table
\echo 'Step 3/4: Creating payroll data table...'
\i 03_create_payroll_data.sql

-- 4. Enhance documents table
\echo 'Step 4/4: Enhancing documents table...'
\i 04_update_documents.sql

\echo 'Phase 1 migration completed successfully!'
\echo ''
\echo 'Summary:'
\echo '- rh_employees: Added 18 new columns'
\echo '- rh_emergency_contacts: Created new table'
\echo '- rh_payroll_data: Created new table'
\echo '- rh_documents: Enhanced with 6 new columns'
\echo '- Created 1 view: vw_employee_documents_checklist'
\echo '- Added RLS policies for all new tables'
\echo '- Created triggers for updated_at and salary sync'
