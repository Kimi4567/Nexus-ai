# TikTok App Review Package — NEXUS AI

Use this package when resubmitting the TikTok Developer app review.

## Recommended Products And Scopes

Keep only the products/scopes that are implemented and demonstrated:

- Login Kit
  - `user.info.basic`
- Content Posting API
  - `video.publish`
  - `video.upload`

TikTok may include `video.upload` by default with Content Posting API. If it appears in the Developer Portal and cannot be removed independently, demonstrate it as the creator-controlled draft/upload flow in the review video.

## App Description

NEXUS AI is an AI marketing operating system for small businesses. The platform helps users create marketing strategies, generate short-form social media content, prepare captions and hashtags, review campaign assets, and approve content before exporting or publishing to connected social platforms.

For TikTok, users can connect their TikTok account, confirm the connected profile, review an approved short-form video and caption inside NEXUS, and explicitly trigger the TikTok publishing action. NEXUS does not publish automatically without user approval.

## Review Description

NEXUS AI is an AI marketing operating system for small businesses. It helps users create marketing strategies, generate short-form video scripts and captions, prepare campaign assets, review content, and approve publishing actions before any content is sent to connected social platforms.

TikTok integration is used only after the user explicitly connects their TikTok account and authorizes the requested scopes through TikTok OAuth.

Requested scopes:

1. `user.info.basic`

NEXUS uses this scope to identify the connected TikTok account inside the NEXUS dashboard. After OAuth authorization, NEXUS fetches the user's TikTok `open_id`, `display_name`, and `avatar_url`. This allows the user to confirm which TikTok account is connected before any content action is taken. NEXUS stores the TikTok `open_id` and basic profile metadata securely to maintain the account connection. This data is not sold or shared with third parties.

2. `video.publish`

NEXUS uses this scope to let users publish an approved short-form video from NEXUS to TikTok using the TikTok Content Posting API. The user first creates or selects a campaign video, reviews the caption and campaign context, confirms the content, and then explicitly clicks the TikTok publishing action. NEXUS sends only the user-approved video URL and caption/title to TikTok using the `PULL_FROM_URL` publishing flow and stores the returned `publish_id` or status for tracking inside the dashboard.

3. `video.upload`

TikTok includes Upload to TikTok as part of Content Posting API. NEXUS demonstrates this as a creator-controlled draft/upload flow: the user reviews the video and caption in NEXUS, explicitly chooses the TikTok upload action, and the content is sent only after approval. This scope is not used to access unrelated TikTok data.

NEXUS does not automatically publish content without user approval. Users can disconnect TikTok at any time from the Connections page. OAuth tokens are encrypted at rest.

## Demo Video Script

Generated review video file:

`public/nexus_ai_tiktok_review_demo_2026.mp4`

Record a 2-4 minute video. Use TikTok Sandbox where possible. If the full sandbox action is unavailable, show the mock review page and clearly explain it is a mockup of the implemented integration.

1. Open TikTok Developer Portal.
2. Show the NEXUS AI app.
3. Show the selected products/scopes:
   - Login Kit: `user.info.basic`
   - Content Posting API: `video.publish`
   - Content Posting API: `video.upload`
4. Open `https://www.nexus-grow.com/tiktok-review-demo`.
5. Explain that this page documents the TikTok review flow and scope usage.
6. Open `https://www.nexus-grow.com/connections`.
7. Show the TikTok connection card.
8. Click Connect TikTok.
9. Show TikTok OAuth/Consent in Sandbox.
10. Approve the sandbox account.
11. Return to NEXUS and show the connected TikTok account name/avatar.
12. Open a campaign/content page or the demo page.
13. Show a short-form video asset and caption prepared by NEXUS.
14. Explain the human approval gate: NEXUS does not publish automatically.
15. Click the TikTok publishing/export action.
16. Show the upload/publish status or mock confirmation.
17. Explain that NEXUS stores only required profile metadata, encrypted tokens, and TikTok publishing status.
18. Show that the user can disconnect TikTok from Connections.

## Reviewer-Facing Demo URL

Use this URL in the review description or video:

`https://www.nexus-grow.com/tiktok-review-demo`

## Resubmission Checklist

- Remove any scopes not implemented and shown in the video.
- Use Sandbox in the demo video if the TikTok portal requires it.
- Make sure the video visibly demonstrates every selected scope.
- If `video.upload` appears in the portal, demonstrate it as the TikTok draft/upload flow.
- Add the detailed Review Description above.
- Add the demo URL above.
