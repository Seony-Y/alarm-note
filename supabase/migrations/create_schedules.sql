create table if not exists public.schedules (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.schedules enable row level security;

drop policy if exists "Users can read own schedules" on public.schedules;
create policy "Users can read own schedules"
on public.schedules for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own schedules" on public.schedules;
create policy "Users can insert own schedules"
on public.schedules for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own schedules" on public.schedules;
create policy "Users can update own schedules"
on public.schedules for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own schedules" on public.schedules;
create policy "Users can delete own schedules"
on public.schedules for delete
using (auth.uid() = user_id);