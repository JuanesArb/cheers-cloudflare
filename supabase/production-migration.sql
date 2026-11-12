-- Ejecutar una sola vez en Supabase > SQL Editor.
-- Completa las tablas necesarias para caja y deja la función de Netlify con acceso seguro.

alter table locations add column if not exists address text default '';
alter table locations add column if not exists hours text default '';
alter table locations add column if not exists whatsapp text default '';
alter table locations add column if not exists instagram text default '';
alter table orders add column if not exists customer_name text default '';
alter table order_items add column if not exists selected_options jsonb default '[]'::jsonb;
alter table order_items add column if not exists note text default '';

-- V6 · cuentas por mesa y clientes fiados.
-- Una cuenta por mesa se forma automáticamente con todos los pedidos que
-- siguen abiertos. Los clientes fiados tienen un libro de movimientos: cargo
-- por consumo y abono cuando pagan.
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

create table if not exists table_requests (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  table_id uuid references dining_tables(id),
  request_type text not null check (request_type in ('Cuenta','Agua','Mesero','Cubiertos')),
  note text,
  resolved_at timestamptz,
  resolved_by uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name text not null,
  active boolean default true,
  sort_order integer default 0
);

create table if not exists cash_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_by text not null,
  opening_amount numeric(12,2) not null default 0,
  opened_at timestamptz not null default now(),
  closed_by text,
  closing_amount numeric(12,2),
  closed_at timestamptz
);

alter table table_requests enable row level security;
alter table product_options enable row level security;
alter table cash_sessions enable row level security;
