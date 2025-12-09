# Phase 1: Database Migration Guide

## Overview
Phase 1 creates the database foundation for the complete employee data system. This includes new fields, tables, and relationships.

## Migration Files Created

1. **01_add_employee_fields.sql** - Adds 18 new columns to `rh_employees`
2. **02_create_emergency_contacts.sql** - Creates emergency contacts table
3. **03_create_payroll_data.sql** - Creates payroll data table
4. **04_update_documents.sql** - Enhances documents table

## How to Run

### Option 1: Run All at Once (Recommended)
Copy and paste the contents of each file into Supabase SQL Editor in order:
1. `01_add_employee_fields.sql`
2. `02_create_emergency_contacts.sql`
3. `03_create_payroll_data.sql`
4. `04_update_documents.sql`

### Option 2: Run Individual Files
Execute each file separately in the Supabase SQL Editor.

## What Gets Created

### New Columns in `rh_employees`
- **Personal Data**: birth_date, nationality, marital_status, id_document_type, id_document_number, niss, personal_email
- **Professional**: contract_type, work_schedule, work_location, employee_number, supervisor_id, professional_category
- **Corporate**: corporate_email, uniform_size, has_access_card, has_keys, notes

### New Tables
- **rh_emergency_contacts**: Emergency contact information
- **rh_payroll_data**: Banking and salary information

### Enhanced Tables
- **rh_documents**: Added document_type, verification tracking, file metadata

### Views Created
- **vw_employee_documents_checklist**: Shows document completion status per employee

## Security Features

All tables have:
- ✅ Row Level Security (RLS) enabled
- ✅ Policies for admin/manager access
- ✅ Policies for employee self-access
- ✅ Automatic `updated_at` triggers
- ✅ Data validation constraints

## Next Steps

After running these migrations:
1. Verify all tables were created successfully
2. Test RLS policies
3. Proceed to Phase 2: Backend API Updates

## Rollback (if needed)

If you need to rollback:
```sql
-- Drop new tables
DROP TABLE IF EXISTS rh_emergency_contacts CASCADE;
DROP TABLE IF EXISTS rh_payroll_data CASCADE;
DROP VIEW IF EXISTS vw_employee_documents_checklist;

-- Remove new columns from rh_employees
ALTER TABLE rh_employees 
  DROP COLUMN IF EXISTS birth_date,
  DROP COLUMN IF EXISTS nationality,
  -- ... (add all new columns)
```
