create or replace function public.track_store_order(
  p_order_id text,
  p_phone text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'orderId', orders.id::text,
    'status', orders.status,
    'paymentStatus', orders.payment_status,
    'fulfillmentMethod', orders.fulfillment_method,
    'salesChannel', orders.sales_channel,
    'createdAt', orders.created_at,
    'total', orders.total,
    'items', orders.items
  )
  from public.orders as orders
  where orders.id::text = p_order_id
    and regexp_replace(coalesce(orders.customer_phone, ''), '[^0-9]', '', 'g')
      = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
  limit 1;
$$;

revoke all on function public.track_store_order(text, text) from public;
grant execute on function public.track_store_order(text, text) to anon, authenticated;

notify pgrst, 'reload schema';