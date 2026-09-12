alter table repositories add column if not exists description_zh text;
comment on column repositories.description_zh is 'Chinese repository summary; null until translated or manually curated';
