-- Add api_enabled flag to channels
-- Allows future API integration to be toggled per channel without code changes

alter table channels add column if not exists api_enabled boolean not null default false;
