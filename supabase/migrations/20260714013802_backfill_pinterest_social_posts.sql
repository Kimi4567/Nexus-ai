-- Earlier content-plan generation persisted Pinterest destinations under the
-- META provider. Repair only rows with explicit Pinterest destination evidence;
-- no platform is inferred from copy or campaign metadata.
UPDATE "SocialPost"
SET "platform" = 'PINTEREST'::"IntegrationType"
WHERE UPPER(COALESCE("publishTarget", '')) = 'PINTEREST'
  AND "platform" = 'META'::"IntegrationType";
