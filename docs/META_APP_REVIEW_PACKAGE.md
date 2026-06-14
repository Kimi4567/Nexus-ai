# NEXUS AI — Meta App Review Package

**App:** Nexus AI · **Domain:** https://www.nexus-grow.com
**Use case:** An AI marketing platform that lets a business connect its own Facebook Page and publish organic posts it has created and approved, with transparent credits.

This document is the submission reference for Meta App Review + Business Verification.

---

## 1. Submission strategy (read first)

**Submit the Facebook publishing permissions first** — they are fully demonstrable today:

- `pages_show_list`
- `pages_read_engagement`
- `pages_manage_posts`

**Defer Instagram permissions** (`instagram_basic`, `instagram_content_publish`) to a **later, separate submission.** They are present in the OAuth scope but **not demonstrated** in the current product (no Instagram account is linked, Instagram publishing is not enabled). Meta rejects permissions you cannot demonstrate, so do not submit them until there is a working Instagram demo.

**Out of scope for this submission:** `read_insights` (post reach/impressions). Basic engagement (likes/comments/shares) is covered by `pages_read_engagement`; full insights are a later milestone.

---

## 2. Per-permission justification

| Permission | Why NEXUS needs it | Data accessed | Where it's used |
|---|---|---|---|
| `pages_show_list` | Let the user pick which Page to publish to. | Page id, Page name | Connections + Publish tab (Page selector) |
| `pages_read_engagement` | Show the user basic engagement on their own posts. | reactions, comment count, share count on the user's posts | Post History / analytics (engagement only; not reach/impressions) |
| `pages_manage_posts` | Publish a user-created, user-approved organic post to the selected Page. | post caption (+ optional image URL); returns post id + permalink | Publish tab → "Publish Now" (only on explicit user click) |

**Not in this submission:** `instagram_basic`, `instagram_content_publish` (deferred), `read_insights` (deferred).

---

## 3. Reviewer test steps (end-to-end)

A live, reviewer-friendly version of this flow is hosted at **https://www.nexus-grow.com/meta-review-demo**.

1. Sign in to NEXUS at https://www.nexus-grow.com.
2. Go to **Connections** → under **Meta (Facebook)** click **Connect account**.
3. Complete Meta's official OAuth; approve the requested permissions and select a Page.
4. NEXUS exchanges the code, stores the token **encrypted**, and shows the connected account + Page.
5. Open a campaign → **Publish** tab. Review/enter a caption and confirm the Page. (No API call yet.)
6. Click **Publish Now**. NEXUS calls the Graph API and publishes the **organic** post.
7. **Verify:** the returned permalink shows the live post on Facebook; the post appears in **Post History** as Published with a **View** link.

**Guarantees shown in the flow:**
- No automatic posting — publishing requires an explicit user click ("Posts publish only when you click Publish — no automatic posting").
- No paid ads / ad spend without explicit user action.
- The user can disconnect at any time; the token is deleted on disconnect.

---

## 4. Required URLs

- **Privacy Policy:** https://www.nexus-grow.com/privacy (includes a "Connected Social Accounts (Meta/Facebook)" section describing permissions, publishing, token encryption, and deletion).
- **Terms of Service:** https://www.nexus-grow.com/terms (includes a "Social Publishing & Connected Accounts" clause: no auto-publish, no paid ads without user action).
- **Data Deletion:**
  - **Callback (signed_request):** `POST https://www.nexus-grow.com/api/social/callback/meta-data-deletion` — verifies Meta's HMAC-SHA256 `signed_request`, records the deletion request, and returns `{ "url": "...", "confirmation_code": "..." }`.
  - **Status / instructions page:** https://www.nexus-grow.com/data-deletion (users and reviewers can check a request's status by confirmation code).
- **Reviewer demo page:** https://www.nexus-grow.com/meta-review-demo

---

## 5. Data handling summary

- Connection uses Meta's official OAuth; NEXUS never sees or stores the user's Facebook password.
- Access tokens are stored **encrypted** (AES-256 at rest, TLS 1.3 in transit) and **deleted on disconnect**.
- Data deletion: handled via the signed-request callback (returns a confirmation code) and the public status page; users can also disconnect in Connections.
- Known limitation: the data-deletion callback records the request and returns the required confirmation response; full automated deletion that maps a Facebook user id to the internal account is completed via an admin/background step (the callback does not store the Facebook user id directly).

---

## 6. Pre-submission checklist

- [ ] App in the correct mode; Business Verification submitted/approved.
- [ ] Valid App Domain + OAuth redirect URIs configured.
- [ ] Privacy Policy URL set (with the Meta section).
- [ ] Data Deletion Callback URL + Instructions URL set in the App Dashboard.
- [ ] Review video recorded following Section 3 on `/meta-review-demo`.
- [ ] Submit ONLY `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.
- [ ] Do NOT submit Instagram permissions in this round.
