-- Private, workspace-scoped source library for evidence-backed Brand Brain claims.
CREATE TABLE IF NOT EXISTS "BrandEvidenceDocument" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageBucket" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_UPLOAD',
  "extractedText" TEXT,
  "extractionMetadata" JSONB,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrandEvidenceDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BrandEvidenceDocument_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "BrandEvidenceDocument_storagePath_key"
  ON "BrandEvidenceDocument"("storagePath");
CREATE INDEX IF NOT EXISTS "BrandEvidenceDocument_workspaceId_status_idx"
  ON "BrandEvidenceDocument"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "BrandEvidenceDocument_workspaceId_createdAt_idx"
  ON "BrandEvidenceDocument"("workspaceId", "createdAt");

CREATE TABLE IF NOT EXISTS "BrandEvidenceClaim" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "claim" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "evidenceExcerpt" TEXT NOT NULL,
  "sourceLocator" TEXT,
  "confidence" DOUBLE PRECISION,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "promotedProof" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BrandEvidenceClaim_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BrandEvidenceClaim_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "BrandEvidenceDocument"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BrandEvidenceClaim_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "BrandEvidenceClaim_workspaceId_status_idx"
  ON "BrandEvidenceClaim"("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "BrandEvidenceClaim_documentId_status_idx"
  ON "BrandEvidenceClaim"("documentId", "status");

-- Application data is accessed only by trusted server routes. Keep these
-- tables invisible to the Supabase Data API even if a future default changes.
ALTER TABLE "BrandEvidenceDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BrandEvidenceClaim" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "BrandEvidenceDocument" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE "BrandEvidenceClaim" FROM anon, authenticated;

-- Signed upload URLs are issued only by the authenticated Nexus server. The
-- bucket stays private and accepts only the lean document formats supported by
-- the deterministic extraction pipeline.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-evidence',
  'brand-evidence',
  false,
  6291456,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/json'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
