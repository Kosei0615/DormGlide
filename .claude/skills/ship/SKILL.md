---
name: ship
description: Release checklist for the DormGlide web app. Use this whenever code in the DormGlide repo has been changed and needs to go live, or the founder says ship, deploy, push, release, publish, "make it live", or asks whether a fix is on the site, and also before committing any change to app.html, js/, or styles/. It prevents the stale-cache and untested-on-phone bugs this project has hit repeatedly.
---

# ship

DormGlide is a build-less React app: `app.html` loads plain `<script>` files
with `?v=N` cache-busters, and pushing to `main` deploys to GitHub Pages at
dormglide.com. There is no build step to catch mistakes, so this checklist is
the safety net. Paths are relative to the repo root (the `DormGlide` folder).

## 1. Bump cache versions

For every file you edited under `js/` or `styles/`, increase its `?v=N` in
`app.html`. Students' phones keep the old file otherwise, and the fix appears
not to work. `terms.html` and `privacy.html` link `styles/main.css` with their
own version number; bump those when the legal pages' look changes.

```bash
git diff --name-only | grep -E '^(js|styles)/'      # what changed
grep -n '?v=' app.html                              # current versions
```

## 2. Verify in the browser, at phone width first

Most students use phones, and most past bugs only showed there.

- Start the preview with `preview_start` name `dormglide` (never a Bash server).
- Set the viewport to mobile (375 wide), reload, and check the console for errors.
- The preview cannot reach Supabase, so logged-in screens are verified with
  fixtures: mount the component with `ReactDOM.createRoot` and sample props,
  then inspect the DOM or take a screenshot.
- Check anything you touched against the known traps:
  - **Icons**: Font Awesome is replaced by an emoji map near the end of
    `styles/main.css`. A new `fa-*` class with no mapping renders as "•". Add a mapping line.
  - **Modals**: overlays must sit above the phone bottom nav (z-index 1100). New overlays use 1200.
  - **Page changes** scroll to top (App.js); long modals must keep their primary action visible on a 640px-tall screen.
  - **Glyde mode**: test both `data-mode` values if the change touches shared UI.
- Then check desktop width once.

## 3. Database changes

Schema and deal-flow changes are proposed to the founder first and applied
only after a yes. Small UI changes need no approval.

- Add a numbered, idempotent file in `supabase/multi-campus/` and apply it with the Supabase MCP `apply_migration`.
- RLS is the security boundary. Never trust `user_metadata`; keep campus isolation (`school_id = current_school_id()`).
- New SECURITY DEFINER helpers pin `search_path` and revoke EXECUTE from `public, anon` (and from `authenticated` if only triggers call them).
- Verify with a simulated user inside a transaction that ends in `rollback`.
- Never re-run the legacy scripts in `supabase/chat/` or the old products SQL.
- Bulk email goes through `public.email_outbox` and the founder runs the send.

## 4. Commit and push

Commit only the files that belong to the change, with a message that says what
was wrong and what changed. End the message with the co-author line the
session specifies. Push to `main`.

## 5. Confirm it is live

GitHub Pages takes one to three minutes. Check the live site serves the new
version before telling the founder it's done:

```bash
curl -s "https://dormglide.com/app.html?cb=$RANDOM" | grep -o 'js/App.js?v=[0-9]*'
```

## 6. Update the records

- `../HANDOFF.md` (project root, outside git): what changed, why, and any gotcha a future session would otherwise rediscover.
- `UX-ISSUES.md`: close or add items.

## Secrets

Never put tokens or keys in chat, commits, or files in the repo. The Supabase
token lives in `../.mcp.json`; the Resend key lives in Supabase Vault. If a
secret is ever pasted in chat, tell the founder to revoke it.
