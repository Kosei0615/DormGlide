---
name: ig-post
description: Create and schedule an Instagram feed post or story for DormGlide (@dormglide) from the brand HTML templates, through Metricool. Use this whenever the founder asks to post, repost, schedule, announce or advertise something on Instagram, wants a "sold" post for an item, a story, a carousel, a new graphic for social, or wants an existing scheduled post changed or parked, even if they only say "post this" or "put it on the story".
---

# ig-post

Turns a headline (and optionally a photo) into a branded Instagram graphic and
schedules it on the DormGlide account. All paths are relative to the repo root
(the `DormGlide` folder).

## Why the steps are in this order

Metricool fetches media from a **public URL**, and the images are served by
GitHub Pages from this repo. So an image must be committed, pushed, and
actually live before it is scheduled. Scheduling earlier publishes the old
file. That one constraint drives the whole workflow.

## House rules (founder decisions, don't relitigate)

- The address printed on images and in captions is plain **dormglide.com**.
  Never print "/ig", and never write "link in bio": every extra step loses
  people, and the founder found "/ig" confusing.
- Every image carries a **QR code** that encodes `https://dormglide.com/ig`
  (`qr-ig.png`, or `qr-ig-orange.png` on Glyde/orange designs). The QR keeps
  sign-up attribution (`signup_source = instagram`) without showing the suffix.
- Caption call to action: "Scan the code or go to dormglide.com".
- Hashtags: `#Denison #DenisonUniversity #Denison2027 #Denison2028 #Denison2029 #Denison2030 #DormGlide` plus one or two topical ones.
- "Sold" posts use the **real listing photo**, and only for deals that are
  actually completed. Ask before naming or showing another student's item.
- Blue = DormGlide (goods), orange = Glyde (services). Posts made for
  Instagram should not be the print poster shrunk down.
- The pay rule appears verbatim where space allows: "Pay at pickup, after
  you've seen it, never before." (Glyde: "Pay at the session, in person, never before.")

## Workflow

1. **Pick a template** in `marketing/instagram/` and copy it to a new name.
   - `0N-*.html` square feed (1080×1080): how-it-works, sold-item, wishlist, glyde.
   - `08-launch-*.html` portrait feed (1080×1350): cover / photo-led / tile grid. Best for carousels.
   - `stories/sN-*.html` story (1080×1920). Keep content clear of the top and bottom ~250px, which Instagram covers with its own UI.
   Edit the text in the copy. For a photo, put a JPEG next to the HTML
   (convert HEIC with `sips -s format jpeg in.HEIC --out out.jpg`, then crop to the subject).
2. **Render and verify**:
   ```bash
   python3 .claude/skills/ig-post/scripts/render_ig.py --size feed|portrait|story <file.html> [...]
   ```
   It writes the PNG next to the HTML and fails if the QR code is clipped,
   missing, or wrong, or if an asset is missing. Then **look at the PNG**
   (Read tool). Text overflow that clips the bottom is the most common defect;
   shrink fonts or padding and re-render until nothing is cut off.
3. **Commit and push** the HTML, PNG, and any new assets.
4. **Wait for the deploy**:
   ```bash
   .claude/skills/ig-post/scripts/wait_deploy.sh marketing/instagram/<file>.png [...]
   ```
   Run it in the background and continue when it reports "deployed".
5. **Schedule in Metricool** (brand id `7135581`, timezone `America/New_York`):
   - Feed: `instagramData.type = "POST"`, caption in `text`, alt text in `mediaAltText`. Several media URLs make a carousel.
   - Story: `instagramData.type = "STORY"`, no `text` (stories have no caption).
   - Default slots: feed Mon/Wed/Fri 18:00, stories daily 12:00. "Post it now" means a few minutes ahead; the date cannot be in the past.
   - When replacing the image on an existing scheduled post, add a cache-buster (`...png?v=N`) so Metricool re-fetches it, and resend the full post content.
6. **Confirm** with `getScheduledPosts` after the publish time and give the founder the Instagram URL.

## Things that are not possible, so say so plainly

- Tappable links: Instagram never makes caption or story text clickable, and no
  scheduler can add a story link sticker. Only a person posting from the app
  can. Offer notification mode (`autoPublish: false`) if the founder wants the
  sticker badly enough to tap once a day.
- Deleting: Metricool cannot delete a published post. The founder deletes it in
  Instagram. To stop a scheduled post, update it with `draft: true`.
- Auto-following or mass DMs: against Instagram's rules and risky for a new account. Decline and suggest manual follows.

## After scheduling

Add a line to `marketing/instagram/CAPTIONS.md` if the caption style changed,
and note anything a future session needs in `../HANDOFF.md`.
