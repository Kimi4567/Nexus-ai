#!/usr/bin/env bash
set -euo pipefail

if [[ "${ALLOW_EPHEMERAL_MARKETING_MIGRATION_TEST:-}" != "1" ]]; then
  echo "Refusing to run: set ALLOW_EPHEMERAL_MARKETING_MIGRATION_TEST=1 for an isolated disposable database." >&2
  exit 64
fi

marketing_test_url="${MARKETING_MIGRATION_TEST_DATABASE_URL:-}"
if [[ -z "${marketing_test_url}" ]]; then
  echo "MARKETING_MIGRATION_TEST_DATABASE_URL is required." >&2
  exit 64
fi

case "${marketing_test_url}" in
  *"@127.0.0.1:"*|*"@localhost:"*) ;;
  *)
    echo "Refusing to run against a non-local database host." >&2
    exit 64
    ;;
esac

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required. Install PostgreSQL client tools or run the CI migration contract job." >&2
  exit 69
fi

script_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
migrations=(
  "supabase/migrations/20260720110000_billing_webhook_event_idempotency.sql"
  "supabase/migrations/20260720121119_crm_lead_operations_foundation.sql"
  "supabase/migrations/20260720125414_crm_assignment_followup_and_intake.sql"
  "supabase/migrations/20260720132727_customer_lifecycle_controls.sql"
  "supabase/migrations/20260720143701_landing_pages_and_conversion_evidence.sql"
  "supabase/migrations/20260720154226_landing_page_experiments.sql"
  "supabase/migrations/20260720161301_landing_page_seo_foundation.sql"
  "supabase/migrations/20260720181911_enforce_marketing_workspace_coherence.sql"
  "supabase/migrations/20260721122156_first_party_conversion_measurement.sql"
  "supabase/migrations/20260729074931_durable_automation_jobs.sql"
  "supabase/migrations/20260729075040_index_automation_job_campaign_workspace_fk.sql"
)

psql "${marketing_test_url}" -v ON_ERROR_STOP=1 -f "${script_root}/scripts/sql/marketing-foundation-baseline.sql"

for migration in "${migrations[@]}"; do
  psql "${marketing_test_url}" -v ON_ERROR_STOP=1 -f "${script_root}/${migration}"
done

psql "${marketing_test_url}" -v ON_ERROR_STOP=1 -f "${script_root}/scripts/sql/verify-marketing-foundation.sql"
