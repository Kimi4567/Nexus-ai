-- Search visibility for campaign landing pages is explicit and defaults to
-- noindex. Draft fields cannot change public metadata until a reviewed publish
-- copies them into the immutable published snapshot and the denormalized
-- publishedSeoIndexable flag used by the sitemap query.

ALTER TABLE "LandingPage"
  ADD COLUMN "seoTitle" TEXT,
  ADD COLUMN "seoDescription" TEXT,
  ADD COLUMN "seoIndexable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publishedSeoIndexable" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "LandingPage"
  ADD CONSTRAINT "LandingPage_seo_title_length" CHECK (
    "seoTitle" IS NULL OR char_length(btrim("seoTitle")) BETWEEN 1 AND 70
  ),
  ADD CONSTRAINT "LandingPage_seo_description_length" CHECK (
    "seoDescription" IS NULL OR char_length(btrim("seoDescription")) BETWEEN 1 AND 180
  ),
  ADD CONSTRAINT "LandingPage_indexable_metadata_required" CHECK (
    NOT "seoIndexable"
    OR (
      "seoTitle" IS NOT NULL
      AND char_length(btrim("seoTitle")) BETWEEN 10 AND 70
      AND "seoDescription" IS NOT NULL
      AND char_length(btrim("seoDescription")) BETWEEN 50 AND 180
    )
  ),
  ADD CONSTRAINT "LandingPage_published_indexable_snapshot_required" CHECK (
    NOT "publishedSeoIndexable"
    OR (
      "publishedVersion" IS NOT NULL
      AND "publishedSnapshot" IS NOT NULL
      AND "publishedHash" IS NOT NULL
    )
  );

-- Only the small subset of live, explicitly indexable pages is needed for the
-- public sitemap. Equality predicates are fixed in the partial index and the
-- range/sort column comes last.
CREATE INDEX "LandingPage_public_sitemap_idx"
  ON "LandingPage" ("publishedAt" DESC, "publicId")
  WHERE "status" = 'PUBLISHED'
    AND "publishedSeoIndexable" = true
    AND "publishedHash" IS NOT NULL;
