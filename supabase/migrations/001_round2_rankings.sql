-- Round 2: forced ranking of the 17 Erasmus V6 constructs.
--
-- Round 1 asked for three independent 1-5 ratings per task, which left the
-- eligible set larger than the final taxonomy and gave no ordering within it.
-- Reviewers asked for a validation round, so Round 2 asks each panellist for a
-- single complete ordering of all 17 tasks, 1 (highest priority for inclusion)
-- through 17.
--
-- Stored long -- one row per reviewer x task -- to match the shape the
-- PACT_Delphi R pipeline already reads (reviewer_code, task_code, task_name,
-- one value column). A ranking is all-or-nothing: there is no partial state to
-- represent, so unlike `ratings` there is no autosave and no nullable value.

-- Applied to the SAME Supabase project as Round 1: `reviewers` is shared, and
-- round2_rankings references it. Fail with an explanation rather than a bare
-- foreign-key error if this is run against a project that has no panel.
do $$
begin
  if not exists (
    select 1 from pg_tables where schemaname = 'public' and tablename = 'reviewers'
  ) then
    raise exception 'public.reviewers is missing. Apply this to the Round 1 Supabase project, which holds the panel.';
  end if;
end
$$;

create table if not exists public.round2_rankings (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.reviewers(id) on delete cascade,

  -- Codebook number, T1..T17. Load-bearing across the project: the R analysis
  -- orders tasks by the numeric suffix, and construct_boundary text refers to
  -- sibling constructs by it.
  task_code text not null,

  -- Denormalised deliberately. Task titles have been reworded between rounds
  -- (V3 -> V6); keeping the title as shown at submission means an export is
  -- interpretable without reconstructing what `cases` said at the time.
  task_name text not null,

  -- 1 = highest priority for inclusion in the final taxonomy.
  rank integer not null,

  -- Position this task held in the randomised list the panellist was first
  -- shown, so anchoring on the start order can be checked rather than assumed
  -- away. Nullable: rankings loaded from outside the app have no start order.
  initial_rank integer,

  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint round2_rankings_rank_range
    check (rank between 1 and 17),
  constraint round2_rankings_initial_rank_range
    check (initial_rank is null or initial_rank between 1 and 17),

  -- One rank per task per reviewer, and no two tasks sharing a rank: together
  -- these make a stored ranking a true permutation, so a malformed write fails
  -- at the database rather than surfacing as a tie in the analysis.
  constraint round2_rankings_reviewer_task_unique unique (reviewer_id, task_code),
  constraint round2_rankings_reviewer_rank_unique unique (reviewer_id, rank)
);

create index if not exists round2_rankings_reviewer_idx
  on public.round2_rankings (reviewer_id);
create index if not exists round2_rankings_task_idx
  on public.round2_rankings (task_code);

-- Every app query goes through createAdminClient() (service role, bypasses
-- RLS). RLS here is what keeps anon out of the public REST API, matching
-- migration 016.
alter table public.round2_rankings enable row level security;

grant select, insert, update, delete on public.round2_rankings to service_role;

-- Write a whole ranking atomically.
--
-- A revision is a delete-then-insert rather than an upsert: re-ranking permutes
-- ranks among existing rows, so row-by-row upserts would transiently duplicate
-- a rank and trip round2_rankings_reviewer_rank_unique. Doing both inside one
-- function body puts them in a single transaction, where the constraint is only
-- checked at statement end.
create or replace function public.save_round2_ranking(
  p_reviewer_id uuid,
  p_task_codes text[],
  p_task_names text[],
  p_initial_codes text[] default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := array_length(p_task_codes, 1);
begin
  if n is distinct from 17 then
    raise exception 'A Round 2 ranking must cover all 17 tasks, got %', coalesce(n, 0);
  end if;

  if array_length(p_task_names, 1) is distinct from n then
    raise exception 'task_names has % entries, expected %',
      coalesce(array_length(p_task_names, 1), 0), n;
  end if;

  if (select count(distinct code) from unnest(p_task_codes) as code) <> n then
    raise exception 'Duplicate task codes in ranking';
  end if;

  if p_initial_codes is not null
     and array_length(p_initial_codes, 1) is distinct from n then
    raise exception 'initial_codes has % entries, expected %',
      coalesce(array_length(p_initial_codes, 1), 0), n;
  end if;

  delete from round2_rankings where reviewer_id = p_reviewer_id;

  insert into round2_rankings
    (reviewer_id, task_code, task_name, rank, initial_rank)
  select
    p_reviewer_id,
    t.code,
    p_task_names[t.ord],
    t.ord::integer,
    case
      when p_initial_codes is null then null
      else array_position(p_initial_codes, t.code)
    end
  from unnest(p_task_codes) with ordinality as t(code, ord);
end;
$$;

grant execute on function public.save_round2_ranking(uuid, text[], text[], text[])
  to service_role;
