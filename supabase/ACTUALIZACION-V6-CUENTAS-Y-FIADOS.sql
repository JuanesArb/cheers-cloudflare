-- CHEERS V6 · Ejecutar una sola vez en Supabase > SQL Editor > Run.
-- No borra productos, ventas ni inventario existentes.

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  name text not null,
  phone text default '',
  credit_limit numeric(12,2) not null default 0,
  notes text default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists customer_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  kind text not null check (kind in ('charge','payment')),
  amount numeric(12,2) not null check (amount > 0),
  method text default '',
  note text default '',
  created_at timestamptz not null default now()
);

alter table orders add column if not exists customer_id uuid references customers(id) on delete set null;
alter table customers enable row level security;
alter table customer_ledger enable row level security;
