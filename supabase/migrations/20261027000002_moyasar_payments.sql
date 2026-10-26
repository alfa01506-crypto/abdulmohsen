alter table public.orders
  add column if not exists payment_method text not null default 'pay_later',
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_provider text,
  add column if not exists payment_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_payment_method_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_payment_method_check
      check (payment_method in ('pay_later', 'moyasar'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_payment_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_payment_status_check
      check (payment_status in ('unpaid', 'pending', 'paid', 'failed'));
  end if;
end;
$$;

create or replace function public.place_wholesale_order_with_payment(
  p_customer_name text,
  p_phone text,
  p_items jsonb,
  p_fulfillment_method text,
  p_payment_method text,
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
  if p_payment_method is null
    or p_payment_method not in ('pay_later', 'moyasar') then
    raise exception using errcode = 'P0001', message = 'Choose a supported payment method.';
  end if;

  v_order := public.place_wholesale_order_with_fulfillment(
    p_customer_name,
    p_phone,
    p_items,
    p_fulfillment_method,
    p_company,
    p_email,
    p_address,
    p_notes
  );

  update public.orders
  set payment_method = p_payment_method,
      payment_status = case when p_payment_method = 'moyasar' then 'pending' else 'unpaid' end
  where id::text = v_order ->> 'orderId';

  return v_order;
end;
$$;

revoke all on function public.place_wholesale_order_with_payment(text, text, jsonb, text, text, text, text, text, text) from public;
grant execute on function public.place_wholesale_order_with_payment(text, text, jsonb, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.confirm_moyasar_order_payment(
  p_order_id text,
  p_payment_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_payment_method text;
  v_payment_status text;
  v_existing_payment_id text;
  v_items jsonb;
  v_item jsonb;
  v_product_id text;
  v_quantity integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception using errcode = '42501', message = 'Server payment verification is required.';
  end if;

  select status::text, payment_method, payment_status, payment_id, items
  into v_status, v_payment_method, v_payment_status, v_existing_payment_id, v_items
  from public.orders
  where id::text = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Order not found.';
  end if;

  if v_payment_status = 'paid' and v_existing_payment_id = p_payment_id then
    return;
  end if;

  if v_payment_method <> 'moyasar'
    or v_payment_status <> 'pending'
    or v_status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'Order is not awaiting this payment.';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) as item(value)
    order by value ->> 'productId'
  loop
    v_product_id := v_item ->> 'productId';
    v_quantity := (v_item ->> 'quantity')::integer;

    update public.products
    set stock = stock - v_quantity
    where id::text = v_product_id
      and stock >= v_quantity;

    if not found then
      raise exception using errcode = 'P0001', message = 'Payment received, but stock is no longer available. Contact the store.';
    end if;
  end loop;

  update public.orders
  set payment_status = 'paid',
      payment_provider = 'moyasar',
      payment_id = p_payment_id,
      status = 'confirmed'
  where id::text = p_order_id;
end;
$$;

revoke all on function public.confirm_moyasar_order_payment(text, text) from public;
revoke all on function public.confirm_moyasar_order_payment(text, text) from anon, authenticated;
grant execute on function public.confirm_moyasar_order_payment(text, text) to service_role;