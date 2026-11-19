alter table public.creative_projects add column selected_artifact_ids uuid[] not null default '{}';
alter table public.creative_projects add constraint chk_selected_artifact_limit check(cardinality(selected_artifact_ids)<=12);
