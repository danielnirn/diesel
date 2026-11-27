-- Diesel Akko: run once in Supabase -> SQL Editor.

create table if not exists public.daily_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  summary_date date not null,
  content text not null default '',
  image_path text,
  analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, summary_date)
);

alter table public.daily_summaries enable row level security;

-- Needed when the project does not grant API access to new tables automatically.
grant select, insert, update, delete on public.daily_summaries to authenticated;

create policy "own summaries" on public.daily_summaries
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Private bucket for the photographed pages; each user only sees their own folder.
insert into storage.buckets (id, name, public)
values ('summary-images', 'summary-images', false)
on conflict (id) do nothing;

create policy "own summary images" on storage.objects
  for all to authenticated
  using (bucket_id = 'summary-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'summary-images' and (storage.foldername(name))[1] = auth.uid()::text);
