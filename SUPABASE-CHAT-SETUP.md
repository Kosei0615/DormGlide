# Supabase Chat Setup (DormGlide)

DormGlide’s chat will **fall back to localStorage** if Supabase chat tables/policies aren’t available.

To make chat work like a real marketplace (buyer/seller messaging across devices), create the required tables + RLS policies in Supabase.

## 1) Create tables

Run this in the **Supabase SQL Editor**:

```sql
-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- Conversations between two users (optionally scoped to a product)
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_a uuid not null,
  participant_b uuid not null,
  product_id text null,
  last_message text null,
  last_message_at timestamptz null,
  created_at timestamptz not null default now()
);

-- Ensure stable conversation lookup (the app sorts participant_a/participant_b)
create unique index if not exists conversations_unique_pair
  on public.conversations(participant_a, participant_b, coalesce(product_id, ''));

create index if not exists conversations_participant_a_idx on public.conversations(participant_a);
create index if not exists conversations_participant_b_idx on public.conversations(participant_b);
create index if not exists conversations_last_message_at_idx on public.conversations(last_message_at desc);

-- Messages within a conversation
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null,
  receiver_id uuid not null,
  product_id text null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on public.messages(conversation_id);
create index if not exists messages_sender_id_idx on public.messages(sender_id);
create index if not exists messages_receiver_id_idx on public.messages(receiver_id);
create index if not exists messages_created_at_idx on public.messages(created_at);
```

## 2) Enable Row Level Security (RLS)

```sql
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
```

## 3) RLS Policies

### Conversations policies

```sql
-- Read: only participants can read
create policy "conversations_select_participants"
on public.conversations
for select
to authenticated
using (auth.uid() = participant_a or auth.uid() = participant_b);

-- Insert: must be one of the participants
create policy "conversations_insert_participants"
on public.conversations
for insert
to authenticated
with check (auth.uid() = participant_a or auth.uid() = participant_b);

-- Update: participants can update (used for last_message / last_message_at)
create policy "conversations_update_participants"
on public.conversations
for update
to authenticated
using (auth.uid() = participant_a or auth.uid() = participant_b)
with check (auth.uid() = participant_a or auth.uid() = participant_b);
```

### Messages policies

```sql
-- Read: sender or receiver can read
create policy "messages_select_participants"
on public.messages
for select
to authenticated
using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Insert: sender must be the logged-in user
create policy "messages_insert_sender"
on public.messages
for insert
to authenticated
with check (auth.uid() = sender_id);
```

## 4) Realtime (optional but recommended)

DormGlide subscribes to inserts on `public.messages` and updates on `public.conversations`.

In Supabase:
- Go to **Database → Replication** (or **Realtime** depending on the UI)
- Enable replication for `messages` and `conversations`

## Notes

- `participant_a` / `participant_b` are stored sorted by the client to avoid duplicate conversations.
- `product_id` is `text` to match the current app’s product ids (strings).
- If you don’t want product-scoped chats, set `product_id` to `null` in the app.
