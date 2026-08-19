alter table public.survey_responses
  add column if not exists hitting_program text,
  add column if not exists throwing_program text,
  add column if not exists weight_room_program text;
