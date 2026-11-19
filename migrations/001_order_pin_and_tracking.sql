-- Romeo's Pizza: order PINs + order tracking (Supabase)
-- Run once in the Supabase SQL editor. Safe to re-run.
-- Neon databases (DATABASE_URL) are upgraded automatically by api/db.js.

-- 1. Columns used by the order API and the tracking page
alter table public.orders add column if not exists order_pin text;
alter table public.orders add column if not exists status text default 'pending';
create index if not exists orders_pin_phone_idx on public.orders (order_pin, customer_phone);

-- 2. Registry of issued PINs. One row per 6-digit PIN; issued_at is refreshed when
--    a PIN is reissued, which is only allowed after 5 days.
create table if not exists public.order_pins (
  pin       text primary key check (pin ~ '^[0-9]{6}$'),
  issued_at timestamptz not null default now()
);
alter table public.order_pins enable row level security; -- no policies: only service_role can touch it

-- 3. Atomic allocation: returns true if the PIN was claimed, false if it is still
--    active (issued less than 5 days ago). Concurrent calls cannot both win.
create or replace function public.allocate_order_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed text;
begin
  if p_pin !~ '^[0-9]{6}$' then
    return false;
  end if;

  insert into order_pins (pin, issued_at) values (p_pin, now())
  on conflict (pin) do update set issued_at = now()
    where order_pins.issued_at < now() - interval '5 days'
  returning pin into claimed;

  return claimed is not null;
end;
$$;

revoke all on function public.allocate_order_pin(text) from public, anon, authenticated;
grant execute on function public.allocate_order_pin(text) to service_role;
