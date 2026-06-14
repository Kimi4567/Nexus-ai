# First Real Meta Publish — Safe Test Checklist
**Goal:** prove the idea → publish loop end-to-end with ONE real post, with zero risk of spam, spend, or a bad public post.
**Owner action required:** every irreversible step (OAuth, publish) is performed by you, not automated.

> Nexus never auto-publishes unless a post is explicitly set to `AUTO`. This test uses **manual** publish only.

---

## Phase 0 — Prerequisites (before connecting anything)

- [ ] Production env vars set in Vercel: `META_APP_ID`, `META_APP_SECRET`, `NEXT_PUBLIC_META_APP_ID`.
- [ ] Meta app is in the correct mode:
  - For a private test, you can publish to **Pages you admin** while the app is in *Development* mode, as long as your account is an admin/tester of both the app and the Page.
  - For publishing on behalf of *other* users / going public, Meta **App Review** of `pages_manage_posts` (+ `instagram_content_publish` for IG) is required. Confirm review status in the Meta dashboard.
- [ ] You have a **throwaway / test Facebook Page** (not the main brand Page) to publish the first test to.
- [ ] An Instagram **Business** account linked to that Page (only if testing IG).

## Phase 1 — Connect (you do the OAuth)

- [ ] Go to `/connections` → **Meta** → "Connect account".
- [ ] Complete Facebook OAuth yourself. Grant the requested Page permissions.
- [ ] Confirm the connection card now shows the connected account + Page(s).
- [ ] Verify in DB/logs: an `Integration` row with `status = CONNECTED` and an encrypted token (token must NOT be stored in plaintext).

## Phase 2 — Prepare a harmless test post

- [ ] Open a test campaign → **Publish** tab (SocialPublisher).
- [ ] Confirm the connected account + Page appear in the selector.
- [ ] Write an obviously-internal caption, e.g. `NEXUS publish test — please ignore 🧪`.
- [ ] Use a neutral test image (or none for a text post).
- [ ] Confirm publish mode is **MANUAL / Publish now** (not AUTO schedule).

## Phase 3 — Publish ONE post (you click the final button)

- [ ] Click **Publish now**. (This is the single irreversible action — do it intentionally.)
- [ ] Watch for success: a `SocialPost` row with `status = PUBLISHED`, a `platformPostId`, and a `platformUrl`.
- [ ] Open the returned `platformUrl` and confirm the post is live and correct on Facebook/Instagram.
- [ ] If it fails: check the `errorMessage` on the SocialPost + Vercel logs (`[Social Publish] Error`). Common causes: token scope, Page admin mismatch, IG not a Business account, app not approved for the permission.

## Phase 4 — Verify the learning loop (the actual product promise)

- [ ] Confirm the published post appears in the campaign's published history.
- [ ] After 24–72h (or via the analytics cron), confirm engagement metrics flow back.
- [ ] Confirm Brand Brain reflects a learning event from real performance (closes idea → publish → learn).

## Phase 5 — Clean up

- [ ] Delete the test post from Facebook/Instagram manually.
- [ ] Optionally disconnect the test account from `/connections` (token deleted on disconnect).

---

## Hard rules during testing
- Do **not** test on the primary brand Page first — use a throwaway Page.
- Do **not** enable AUTO publish mode until manual publish is proven.
- Do **not** run paid ads as part of this test — organic publish only. Paid spend is a separate, explicitly-approved flow.
- One post at a time. Confirm each result before the next.
