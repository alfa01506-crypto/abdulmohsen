alter table public.orders
  add column if not exists customer_name text,
  add column if not exists customer_phone text,
  add column if not exists company text,
  add column if not exists customer_email text,
  add column if not exists delivery_address text,
  add column if not exists notes text,
  add column if not exists items jsonb not null default '[]'::jsonb,
  add column if not exists total numeric(12, 2) not null default 0,
  add column if not exists status text not null default 'pending',
  add column if not exists fulfillment_method text not null default 'home_delivery',
  add column if not exists payment_method text not null default 'pay_later',
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_provider text,
  add column if not exists payment_id text,
  add column if not exists sales_channel text not null default 'wholesale',
  add column if not exists created_at timestamptz not null default now();

alter table public.orders
  alter column delivery_address drop not null;

alter table public.orders
  alter column city drop not null;

update public.products
set category = 'Stationery'
where category is null
  or nullif(trim(category), '') is null
  or lower(trim(category)) = 'general';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_sales_channel_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_sales_channel_check
      check (sales_channel in ('wholesale', 'retail'));
  end if;
end;
$$;

create or replace function public.place_store_order(
  p_customer_name text,
  p_phone text,
  p_items jsonb,
  p_sales_channel text,
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
  v_item jsonb;
  v_product record;
  v_product_id text;
  v_quantity integer;
  v_minimum integer;
  v_seen_ids text[] := '{}';
  v_order_items jsonb := '[]'::jsonb;
  v_total numeric(12, 2) := 0;
  v_order_id text;
begin
  if p_sales_channel is null or p_sales_channel not in ('wholesale', 'retail') then
    raise exception using errcode = 'P0001', message = 'Choose wholesale or retail.';
  end if;

  if p_fulfillment_method is null
    or p_fulfillment_method not in ('home_delivery', 'store_pickup') then
    raise exception using errcode = 'P0001', message = 'Choose home delivery or store pickup.';
  end if;

  if p_fulfillment_method = 'home_delivery'
    and nullif(trim(p_address), '') is null then
    raise exception using errcode = 'P0001', message = 'A delivery address is required.';
  end if;

  if p_payment_method is null
    or p_payment_method not in ('pay_later', 'moyasar') then
    raise exception using errcode = 'P0001', message = 'Choose a supported payment method.';
  end if;

  if nullif(trim(p_customer_name), '') is null
    or nullif(trim(p_phone), '') is null then
    raise exception using errcode = 'P0001', message = 'Contact name and phone are required.';
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' then
    raise exception using errcode = 'P0001', message = 'The basket must be a list of products.';
  end if;

  if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = 'P0001', message = 'The basket is empty or has too many products.';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_items) as item(value)
    order by value ->> 'productId'
  loop
    v_product_id := nullif(trim(v_item ->> 'productId'), '');
    if v_product_id is null
      or coalesce(v_item ->> 'quantity', '') !~ '^[0-9]+$' then
      raise exception using errcode = 'P0001', message = 'A basket item is invalid.';
    end if;

    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity < 1 or v_quantity > 10000
      or v_product_id = any(v_seen_ids) then
      raise exception using errcode = 'P0001', message = 'A basket quantity or product is invalid.';
    end if;
    v_seen_ids := array_append(v_seen_ids, v_product_id);

    select
      product.id::text as id,
      product.name,
      case when p_sales_channel = 'retail'
        then product.retail_price
        else product.wholesale_price
      end as unit_price,
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

    v_minimum := case
      when p_sales_channel = 'retail' then 1
      else v_product.min_order_quantity
    end;

    if v_quantity < v_minimum or v_quantity > v_product.stock then
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
    fulfillment_method,
    payment_method,
    payment_status,
    sales_channel,
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
    p_fulfillment_method,
    p_payment_method,
    case when p_payment_method = 'moyasar' then 'pending' else 'unpaid' end,
    p_sales_channel,
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

revoke all on function public.place_store_order(text, text, jsonb, text, text, text, text, text, text, text) from public;
grant execute on function public.place_store_order(text, text, jsonb, text, text, text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';