-- Keep the enum addition and its first use in separate transactions. Older
-- X/Twitter content-plan rows were stored under META because no X provider
-- enum existed. Move only unambiguous rows to the new provider while
-- preserving their exact publishTarget for UI compatibility.
UPDATE "SocialPost"
SET "platform" = 'X'::"IntegrationType"
WHERE upper(coalesce("publishTarget", '')) IN ('X', 'TWITTER')
  AND "platform" = 'META'::"IntegrationType";
