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
