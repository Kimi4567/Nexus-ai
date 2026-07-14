/**
 * Shared destructive-action confirmation text.
 *
 * Keep the client prompt and API contract in one place so a copy change cannot
 * silently turn every valid reset into a 400 response.
 */
export const WORKSPACE_RESET_CONFIRMATION = 'RESET MY NEXUS WORKSPACE' as const
