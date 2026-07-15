-- Image refund reconciliation runs every ten minutes and only examines paid
-- image debits that can be linked to a SocialPost or GeneratedVisual. Keep the
-- hot path small as the immutable credit ledger grows.
CREATE INDEX IF NOT EXISTS "CreditTransaction_image_refund_reconciliation_idx"
  ON "CreditTransaction" ("entityType", "entityId", "createdAt" DESC)
  WHERE "action" = 'IMAGE_GENERATION'
    AND "amount" < 0
    AND "entityType" IN ('social_post_image', 'generated_visual_image');

-- Supports the idempotency NOT EXISTS lookup for an exact debit refund.
CREATE INDEX IF NOT EXISTS "CreditTransaction_exact_refund_lookup_idx"
  ON "CreditTransaction" ("entityId")
  WHERE "action" = 'REFUND'
    AND "entityType" = 'credit_transaction';
