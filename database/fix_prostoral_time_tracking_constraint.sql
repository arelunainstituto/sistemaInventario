-- Remove the restrictive CHECK constraint on the stage column
-- This allows custom stages (e.g., "Polimento", "Enceramento") to be inserted

-- The constraint name from the error log is "prostoral_work_order_time_tracking_stage_check"
ALTER TABLE prostoral_work_order_time_tracking DROP CONSTRAINT IF EXISTS prostoral_work_order_time_tracking_stage_check;

-- Also try dropping "check_stage" just in case it was named differently in some environments
ALTER TABLE prostoral_work_order_time_tracking DROP CONSTRAINT IF EXISTS check_stage;
