-- Add X as a first-class organic publishing provider. This is additive and
-- preserves every existing integration and post row.
ALTER TYPE "IntegrationType" ADD VALUE IF NOT EXISTS 'X';
