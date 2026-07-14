-- Pinterest remains its own provider and campaign platform throughout the
-- execution ledger. Keeping these as enum values prevents accidental fallback
-- to Meta and lets Prisma enforce the same contract as PostgreSQL.
ALTER TYPE "Platform" ADD VALUE IF NOT EXISTS 'PINTEREST';
ALTER TYPE "IntegrationType" ADD VALUE IF NOT EXISTS 'PINTEREST';
