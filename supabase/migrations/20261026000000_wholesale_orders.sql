alter table public.products
  add column if not exists category text not null default 'General',
  add column if not exists description text not null default '',
  add column if not exists image_url text,
  add column if not exists sku text,
  add column if not exists min_order_quantity integer not null default 1,
  add column if not exists is_active boolean not null default true;

alter table public.orders
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists company text,
  add column if not exists customer_email text,
  add column if not exists delivery_address text,
  add column if not exists notes text,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists status text not null default 'pending',
  add column if not exists total numeric(12, 2) not null default 0,
  add column if not exists created_at timestamptz not null default now();

grant select on public.products to anon, authenticated;
alter table public.products enable row level security;

drop policy if exists "Public can read active products" on public.products;
drop policy if exists "Admins can update products" on public.products;
drop policy if exists products_catalogue_read on public.products;
create policy products_catalogue_read
  on public.products
  for select
  to anon, authenticated
  using (is_active);

drop policy if exists products_admin_manage on public.products;
create policy products_admin_manage
  on public.products
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users
      where user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.admin_users
      where user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.products to authenticated;

create or replace function public.place_wholesale_order(
  p_customer_name text,
  p_phone text,
  p_items jsonb,
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
  v_item jsonb;
  v_product record;
  v_product_id text;
  v_quantity integer;
  v_seen_ids text[] := '{}';
  v_order_items jsonb := '[]'::jsonb;
  v_total numeric(12, 2) := 0;
  v_order_id text;
begin
  if nullif(trim(p_customer_name), '') is null
    or nullif(trim(p_phone), '') is null then
    raise exception using errcode = 'P0001', message = 'Contact name and phone are required.';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'The basket must be a list of products.';
  end if;

  if jsonb_array_length(p_items) = 0
    or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = 'P0001', message = 'The basket is empty or contains too many items.';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_items) as item(value)
    order by value ->> 'productId'
  loop
    v_product_id := nullif(trim(v_item ->> 'productId'), '');

    if v_product_id is null
      or coalesce(v_item ->> 'quantity', '') !~ '^[0-9]+$' then
      raise exception using errcode = 'P0001', message = 'An item in the basket is invalid.';
    end if;

    v_quantity := (v_item ->> 'quantity')::integer;

    if v_product_id = any(v_seen_ids) then
      raise exception using errcode = 'P0001', message = 'The basket contains a duplicate product.';
    end if;
    v_seen_ids := array_append(v_seen_ids, v_product_id);

    select
      product.id::text as id,
      product.name,
      product.wholesale_price as unit_price,
      product.stock,
      product.min_order_quantity
    into v_product
    from public.products as product
    where product.id::text = v_product_id
      and product.is_active = true
    for update;

    if not found then
      raise exception using errcode = 'P0001', message = 'A requested product is no longer available.';
    end if;

    if v_quantity < v_product.min_order_quantity
      or v_quantity > v_product.stock then
      raise exception using errcode = 'P0001', message = 'A requested quantity is outside the current stock or minimum order limit.';
    end if;

    v_total := v_total + (v_product.unit_price * v_quantity);
    v_order_items := v_order_items || jsonb_build_array(jsonb_build_object(
      'productId', v_product.id,
      'name', v_product.name,
      'unitPrice', v_product.unit_price,
      'quantity', v_quantity,
      'subtotal', v_product.unit_price * v_quantity
    ));
  end loop;

  insert into public.orders (
    customer_name,
    customer_phone,
    company,
    customer_email,
    delivery_address,
    notes,
    items,
    total,
    status,
    created_at
  ) values (
    trim(p_customer_name),
    trim(p_phone),
    nullif(trim(p_company), ''),
    nullif(trim(p_email), ''),
    nullif(trim(p_address), ''),
    nullif(trim(p_notes), ''),
    v_order_items,
    v_total,
    'pending',
    now()
  )
  returning id::text into v_order_id;

  return jsonb_build_object(
    'orderId', v_order_id,
    'total', v_total,
    'items', v_order_items
  );
end;
$$;

revoke all on function public.place_wholesale_order(text, text, jsonb, text, text, text, text) from public;
grant execute on function public.place_wholesale_order(text, text, jsonb, text, text, text, text) to anon, authenticated;

create or replace function public.update_wholesale_order_status(
  p_order_id text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_status text;
  v_payment_status text;
  v_items jsonb;
  v_item jsonb;
  v_product_id text;
  v_quantity integer;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Admin access is required.';
  end if;

  if p_status is null or p_status not in ('pending', 'confirmed', 'fulfilled', 'cancelled') then
    raise exception using errcode = 'P0001', message = 'That order status is not supported.';
  end if;

  select status::text, items, payment_status
  into v_current_status, v_items, v_payment_status
  from public.orders
  where id::text = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Order not found.';
  end if;

  if v_current_status = p_status then
    return;
  end if;

  if p_status = 'cancelled' and v_payment_status = 'paid' then
    raise exception using errcode = 'P0001', message = 'Refund the payment before cancelling this order.';
  end if;

  if (p_status = 'confirmed' and v_current_status <> 'pending')
    or (p_status = 'fulfilled' and v_current_status <> 'confirmed')
    or (p_status = 'cancelled' and v_current_status not in ('pending', 'confirmed')) then
    raise exception using errcode = 'P0001', message = 'That status change is not allowed.';
  end if;

  if p_status = 'confirmed' then
    for v_item in
      select value
      from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) as item(value)
    loop
      v_product_id := v_item ->> 'productId';
      v_quantity := (v_item ->> 'quantity')::integer;

      update public.products
      set stock = stock - v_quantity
      where id::text = v_product_id
        and stock >= v_quantity;

      if not found then
        raise exception using errcode = 'P0001', message = 'Insufficient stock to confirm this order.';
      end if;
    end loop;
  elsif p_status = 'cancelled' and v_current_status = 'confirmed' then
    for v_item in
      select value
      from jsonb_array_elements(coalesce(v_items, '[]'::jsonb)) as item(value)
    loop
      v_product_id := v_item ->> 'productId';
      v_quantity := (v_item ->> 'quantity')::integer;

      update public.products
      set stock = stock + v_quantity
      where id::text = v_product_id;
    end loop;
  end if;

  update public.orders
  set status = p_status
  where id::text = p_order_id;
end;
$$;

revoke all on function public.update_wholesale_order_status(text, text) from public;
revoke all on function public.update_wholesale_order_status(text, text) from anon;
grant execute on function public.update_wholesale_order_status(text, text) to authenticated;

drop policy if exists orders_admin_read on public.orders;
alter table public.orders enable row level security;
create policy orders_admin_read
  on public.orders
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.admin_users
      where user_id = auth.uid()
    )
  );

grant select on public.orders to authenticated;
revoke all on public.orders from anon;
revoke all on public.orders from public;