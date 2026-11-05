-- To-Do: status 'waiting' + whom we are waiting on.
-- Run in the family-apps SQL editor. Applied: 2026-11-05
alter table holiday_ancillaries add column if not exists waiting_on text;
