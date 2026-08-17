grant usage on schema public to service_role;

grant select, insert, update, delete on table public.surveys to service_role;
grant select, insert, update, delete on table public.survey_responses to service_role;
grant select, insert, update, delete on table public.survey_rankings to service_role;
