# CS-1 Creative Studio IA Truth-Safe Foundation

## Objective

Make the existing campaign creative area clearer and safer without building a new editor or changing product behavior.

CS-1 reframes the current surfaces as an operator-led creative workflow:

- Creative Brief is a planning artifact.
- Content Hub is for post review, media readiness, and media assignment.
- Paid Campaign Brief is planning and export-readiness support only.
- Campaign Visuals is a generated visual gallery for review.
- `/studio` is a script and copy lab, not a visual design editor.

## CS-0 Audit Conclusion

The product already has useful creative building blocks: Creative Brief generation, Brand Brain-informed visual generation, Content Hub media assignment, and a text/content lab at `/studio`.

It does not yet have a campaign-linked visual editor, creative asset model, template/layer system, resize engine, export package, or creative approval state. The interface should not imply those capabilities until they exist.

## What Changed

- Added a conservative "Next creative action" panel to the Campaign Visuals tab.
- Clarified AI Creative Brief as planning before production.
- Clarified User Asset Mode as using uploaded photos and logos when available.
- Clarified AI Concept Mode as concept directions for review.
- Clarified Content Hub as post review, media readiness, and platform previews.
- Softened Paid Campaign Brief copy to planning notes informed by Brand Brain.
- Added a helper above Campaign Visuals explaining generated visuals are not attached to posts or published automatically.
- Reframed `/studio` as NEX Content Lab for scripts, hooks, captions, and storyboard text.

## What The Visuals Tab Truly Does Today

The Visuals tab routes users to existing creative workflows and embeds the campaign visual generator. It does not publish content, schedule posts, start paid ad campaigns, or automatically attach generated visuals to posts.

## What `/studio` Truly Does Today

`/studio` generates marketing text: scripts, hooks, captions, and storyboard drafts. It can use Brand Brain context when available. It is not a visual design editor and it is not connected to campaign post media assignment.

## What Remains Missing

- Campaign creative kit model.
- Post-to-generated-visual relationship.
- Template and layout selection.
- Text layer editing.
- Logo/color controls.
- Platform resizing and safe-area preview.
- Export package.
- Creative approval state.
- Performance learning back into Brand Brain.

## Intentionally Not Changed

- No APIs changed.
- No schema or migrations changed.
- No billing, credit, or pricing logic changed.
- No generation behavior changed.
- No VisualGenerator behavior changed.
- No Content Hub behavior changed.
- No publishing, scheduling, cron, or platform API behavior changed.
- No dashboard or billing page changes.

## Future Roadmap

- CS-2 Creative Brief workspace cleanup.
- CS-3 Creative Kit planning model.
- CS-4 Asset-to-post assignment improvements.
- CS-5 Lightweight editor MVP.
- CS-6 Creative performance learning.

## QA Notes

Validate the Campaign Visuals tab and `/studio` in desktop and mobile. Confirm no generation, publishing, scheduling, ad execution, or credit spend is triggered by the new copy and navigation.
