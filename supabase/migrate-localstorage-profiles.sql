do $$
declare
  has_owner_id boolean;
  has_profile_id boolean;
  existing_rows bigint;
begin
  if to_regclass('public.entries') is null then
    raise exception 'public.entries 테이블이 없습니다. 먼저 supabase/schema.sql을 실행하세요.';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entries'
      and column_name = 'owner_id'
  ) into has_owner_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entries'
      and column_name = 'profile_id'
  ) into has_profile_id;

  if has_owner_id and not has_profile_id then
    execute 'select count(*) from public.entries' into existing_rows;
    if existing_rows > 0 then
      raise exception 'entries에 기존 행이 %개 있습니다. owner_id와 colly/baebjji의 매핑을 먼저 정한 뒤 별도 데이터 변환이 필요합니다.', existing_rows;
    end if;
  end if;
end
$$;

drop policy if exists "read own entries" on public.entries;
drop policy if exists "insert own entries" on public.entries;
drop policy if exists "update own entries" on public.entries;
drop policy if exists "delete own entries" on public.entries;
drop policy if exists "Users can read their own entries" on public.entries;
drop policy if exists "Users can insert their own entries" on public.entries;
drop policy if exists "Users can update their own entries" on public.entries;
drop policy if exists "Users can delete their own entries" on public.entries;

alter table public.entries
  add column if not exists profile_id text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'entries'
      and column_name = 'owner_id'
  ) then
    alter table public.entries alter column owner_id drop not null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.entries'::regclass
      and conname = 'entries_profile_id_check'
  ) then
    alter table public.entries
      add constraint entries_profile_id_check
      check (profile_id in ('colly', 'baebjji'));
  end if;
end
$$;

alter table public.entries alter column profile_id set not null;

drop index if exists public.entries_owner_created_at_idx;
create index if not exists entries_profile_created_at_idx
  on public.entries (profile_id, created_at desc);

alter table public.entries enable row level security;
revoke all on public.entries from anon, authenticated;
grant all on public.entries to service_role;