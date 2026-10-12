create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  profile_id text not null check (profile_id in ('colly', 'baebjji')),
  type text not null check (type in ('word', 'pattern', 'shadowing')),
  english text not null,
  korean text not null,
  pronunciation text,
  example text,
  tags text[] not null default '{}',
  created_at timestamptz not null,
  reviewed_at timestamptz
);

create index if not exists entries_profile_created_at_idx
  on public.entries (profile_id, created_at desc);

alter table public.entries enable row level security;

revoke all on public.entries from anon, authenticated;
grant all on public.entries to service_role;
