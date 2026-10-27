-- To-Do: status 'waiting' + whom we are waiting on.
-- Run in the family-apps SQL editor. Applied: (date) ___
alter table holiday_ancillaries add column if not exists waiting_on text;
