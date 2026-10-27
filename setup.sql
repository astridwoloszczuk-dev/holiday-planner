-- Run this in your family-apps Supabase SQL editor

create table holidays (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  destination   text not null,
  country       text,
  emoji         text default '✈️',
  status        text not null default 'idea',   -- idea | upcoming | current | past
  depart_date   date,
  return_date   date,
  notes         text,
  itinerary_raw text,
  created_at    timestamptz default now()
);

create table holiday_days (
  id                 uuid primary key default gen_random_uuid(),
  holiday_id         uuid references holidays(id) on delete cascade not null,
  day_date           date not null,
  day_number         int,
  accommodation      text,
  accommodation_city text,
  morning            text,
  morning_status     text default 'free',   -- free | to_book | planned
  lunch              text,
  lunch_status       text default 'free',
  afternoon          text,
  afternoon_status   text default 'free',
  evening            text,
  evening_status     text default 'free',
  notes              text
);

create table holiday_documents (
  id         uuid primary key default gen_random_uuid(),
  holiday_id uuid references holidays(id) on delete cascade not null,
  title      text not null,
  doc_type   text default 'other',   -- passport | visa | insurance | other
  person     text default 'all',
  notes      text,
  status     text default 'needed', -- needed | have | na
  deadline   date
);

create table holiday_packing (
  id           uuid primary key default gen_random_uuid(),
  holiday_id   uuid references holidays(id) on delete cascade not null,
  category     text not null default 'misc',
  item         text not null,
  reason       text,
  person       text default 'all',
  is_obvious   boolean default true,
  checked      boolean default false,
  ai_generated boolean default false
);

create table holiday_ancillaries (
  id         uuid primary key default gen_random_uuid(),
  holiday_id uuid references holidays(id) on delete cascade not null,
  type       text default 'activity',  -- restaurant | activity | spa | transfer | hotel | flight | other
  name       text not null,
  day_date   date,
  status     text default 'to_book',   -- to_book | considering | booked
  notes      text,
  link       text
);

alter table holidays            enable row level security;
alter table holiday_days        enable row level security;
alter table holiday_documents   enable row level security;
alter table holiday_packing     enable row level security;
alter table holiday_ancillaries enable row level security;

create policy "allow all" on holidays            for all using (true) with check (true);
create policy "allow all" on holiday_days        for all using (true) with check (true);
create policy "allow all" on holiday_documents   for all using (true) with check (true);
create policy "allow all" on holiday_packing     for all using (true) with check (true);
create policy "allow all" on holiday_ancillaries for all using (true) with check (true);

-- 27 Oct 2026 (migrations/2026-10-27-packing-to-buy.sql): per-person lists
alter table holiday_packing add column if not exists deleted boolean not null default false;
alter table holiday_packing add column if not exists to_buy  boolean not null default false;
