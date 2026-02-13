drop policy if exists "conversations_select_participants" on public.conversations;
drop policy if exists "conversations_insert_participants" on public.conversations;
drop policy if exists "conversations_update_participants" on public.conversations;

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
