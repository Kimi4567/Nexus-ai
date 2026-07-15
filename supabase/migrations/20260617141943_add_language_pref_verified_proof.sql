ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "languagePreference" TEXT;
ALTER TABLE "BrandProfile" ADD COLUMN IF NOT EXISTS "verifiedProof" TEXT[] NOT NULL DEFAULT '{}';
