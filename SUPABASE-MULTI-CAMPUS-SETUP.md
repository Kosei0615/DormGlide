# Supabase Multi-Campus Setup (DormGlide)

DormGlide now runs as isolated per-university markets. Users sign up with their
school (.edu) email, the email domain assigns them to a campus, and Row Level
Security guarantees they only ever see listings, chats, and ratings from their
own campus.

## 1) Run the migrations (in order)

In the **Supabase SQL Editor**, run these four files from `supabase/multi-campus/`, in order:

| File | What it does |
|---|---|
| `01_schools.sql` | `schools` + `school_domains` registry, seeds Denison |
| `02_profiles.sql` | `profiles` table (the trusted campus anchor), signup triggers that reject unsupported domains and auto-create profiles, backfill for existing users |
| `03_tenant_columns.sql` | Adds `school_id` to `products`/`listings`/`conversations`/`seller_ratings`, backfills from profiles, auto-assigns on insert via triggers |
| `04_campus_rls.sql` | **The isolation switch.** Replaces public-read policies with campus-scoped RLS, fixes the keyword-alert trigger to be campus-scoped |

Run `04` only after `03` finishes — it's what flips visibility from "everyone" to "same campus".

## 2) Dashboard settings (one-time)

- **Authentication → Providers → Email → "Confirm email" = ON.**
  The domain check proves the address *format*; email confirmation proves the
  student actually owns the .edu inbox. Without it, campus assignment is spoofable.
- Recommended: configure **custom SMTP** (Auth → SMTP) so confirmation emails
  aren't limited to Supabase's built-in ~2 emails/hour.

## 3) Verify

1. Sign up with a `@denison.edu` address → signup form shows
   "✓ You'll join the Denison University market"; confirmation email arrives.
2. Sign up with `@gmail.com` → rejected client-side ("ending in .edu") and, if
   forced via API, rejected by the database trigger.
3. Sign up with an unsupported .edu (e.g. `@harvard.edu`) → "DormGlide isn't at
   your school yet".
4. After login, the header subtitle shows your school name, and the user menu
   shows "🏫 Denison University market".
5. Listings/chats created by users at another school are invisible (test with a
   second school added, below).

Users whose email domain matches no school (old test accounts) get no profile
and see an **empty** market — list them with:

```sql
select u.id, u.email from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
```

## 4) Adding a new university later

Two inserts. Nothing else — no code deploy, no policy changes:

```sql
insert into public.schools (name, slug) values ('Ohio State University', 'osu');

insert into public.school_domains (domain, school_id, is_primary)
select 'osu.edu', id, true from public.schools where slug = 'osu';
```

From that moment, `@osu.edu` signups are accepted, land in their own isolated
market, and the signup form live-displays "You'll join the Ohio State University
market". If a school uses several domains (`osu.edu`, `mail.osu.edu`, …), add one
`school_domains` row per domain pointing at the same school.

To pause a school without deleting anything: `update public.schools set status = 'waitlist' where slug = 'osu';`
(new signups are rejected; existing users keep working).

## How the isolation works (reference)

- **Trust anchor**: `public.profiles.school_id`, set server-side by a trigger at
  signup from the email domain. Clients cannot write it (a trigger rejects any
  change), and it is deliberately *not* in `user_metadata` (which users can edit).
- **Tenant columns**: `products`, `listings`, `conversations`, `seller_ratings`
  carry `school_id`, stamped automatically on insert by a `before insert`
  trigger from the authenticated user's profile — clients never send it.
- **RLS**: every campus-scoped table's `select` policy is
  `school_id = public.current_school_id()`. Messages inherit isolation through
  their conversation; wishlists/alerts/notifications are own-rows-only and thus
  already campus-safe (keyword-alert notifications are additionally
  campus-filtered in the trigger).
- **Anonymous browsing is off**: an anon visitor has no campus, so `products`
  reads now require login. (Rows with `school_id` null — legacy/demo data — are
  invisible to everyone.)
