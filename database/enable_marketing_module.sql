-- Enable Marketing Module (Remove "In Development" status)
UPDATE modules 
SET in_development = false 
WHERE code = 'marketing';
