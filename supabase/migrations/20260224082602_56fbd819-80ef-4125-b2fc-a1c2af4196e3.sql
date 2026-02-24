
-- Make contract_id, project_id, and contract_no nullable for contractless small hakedis
ALTER TABLE hakedisler ALTER COLUMN contract_id DROP NOT NULL;
ALTER TABLE hakedisler ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE hakedisler ALTER COLUMN contract_no DROP NOT NULL;
