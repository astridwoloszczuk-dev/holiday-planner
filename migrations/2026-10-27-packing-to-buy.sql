-- Per-person packing lists: soft delete + "don't own it" (the shopping list).
-- Run in the family-apps SQL editor. Applied: (date) ___
alter table holiday_packing add column if not exists deleted boolean not null default false;
alter table holiday_packing add column if not exists to_buy  boolean not null default false;
