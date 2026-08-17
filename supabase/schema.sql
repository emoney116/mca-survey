create extension if not exists pgcrypto;

create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  player_name text not null,
  personal_goal text,
  additional_notes text,
  edit_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists survey_rankings (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references survey_responses(id) on delete cascade,
  goal_key text not null,
  goal_label text not null,
  rank integer not null check (rank between 1 and 10),
  created_at timestamptz not null default now(),
  unique (response_id, goal_key),
  unique (response_id, rank)
);

create index if not exists survey_responses_survey_id_created_at_idx
  on survey_responses (survey_id, created_at desc);

create index if not exists survey_rankings_response_id_rank_idx
  on survey_rankings (response_id, rank);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists survey_responses_set_updated_at on survey_responses;
create trigger survey_responses_set_updated_at
before update on survey_responses
for each row
execute function set_updated_at();

alter table surveys enable row level security;
alter table survey_responses enable row level security;
alter table survey_rankings enable row level security;

insert into surveys (id, title, active)
values ('00000000-0000-4000-8000-000000000001', 'Metrolina Baseball Fall Development Survey', true)
on conflict (id) do nothing;

grant usage on schema public to service_role;

grant select, insert, update, delete on table public.surveys to service_role;
grant select, insert, update, delete on table public.survey_responses to service_role;
grant select, insert, update, delete on table public.survey_rankings to service_role;
