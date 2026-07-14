-- Threads is a first-class organic publishing and measurement channel.
-- Enum additions are idempotent so preview/live reconciliation stays safe.
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'THREADS';
ALTER TYPE "IntegrationType" ADD VALUE IF NOT EXISTS 'THREADS';
