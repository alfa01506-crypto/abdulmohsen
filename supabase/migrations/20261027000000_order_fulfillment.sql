alter table public.orders
  add column if not exists fulfillment_method text not null default 'home_delivery';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_fulfillment_method_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_fulfillment_method_check
      check (fulfillment_method in ('home_delivery', 'store_pickup'));
  end if;
end;
$$;

create or replace function public.place_wholesale_order_with_fulfillment(
  p_customer_name text,
  p_phone text,
  p_items jsonb,
  p_fulfillment_method text,
  p_company text default null,
  p_email text default null,
  p_address text default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order jsonb;
begin
  if p_fulfillment_method is null
    or p_fulfillment_method not in ('home_delivery', 'store_pickup') then
    raise exception using errcode = 'P0001', message = 'Choose home delivery or store pickup.';
  end if;

  if p_fulfillment_method = 'home_delivery'
    and nullif(trim(p_address), '') is null then
    raise exception using errcode = 'P0001', message = 'A delivery address is required for home delivery.';
  end if;

  v_order := public.place_wholesale_order(
    p_customer_name,
    p_phone,
    p_items,
    p_company,
    p_email,
    p_address,
    p_notes
  );

  update public.orders
  set fulfillment_method = p_fulfillment_method
  where id::text = v_order ->> 'orderId';

  return v_order;
end;
$$;

revoke all on function public.place_wholesale_order_with_fulfillment(text, text, jsonb, text, text, text, text, text) from public;
grant execute on function public.place_wholesale_order_with_fulfillment(text, text, jsonb, text, text, text, text, text) to anon, authenticated;