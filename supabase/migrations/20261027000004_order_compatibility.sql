alter table public.orders
  alter column delivery_address drop not null,
  alter column city drop not null;

alter table public.orders
  drop constraint if exists orders_payment_method_check;

alter table public.orders
  drop constraint if exists orders_payment_status_check;

notify pgrst, 'reload schema';

create or replace function public.admin_set_manual_payment_status(
  p_order_id text,
  p_payment_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_method text;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.admin_users
    where user_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Admin access is required.';
  end if;

  if p_payment_status is null or p_payment_status not in ('paid', 'unpaid') then
    raise exception using errcode = 'P0001', message = 'Choose paid or unpaid.';
  end if;

  select payment_method
  into v_payment_method
  from public.orders
  where id::text = p_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Order not found.';
  end if;

  if v_payment_method = 'moyasar' then
    raise exception using errcode = 'P0001', message = 'Moyasar payments must be confirmed by the payment verifier.';
  end if;

  update public.orders
  set payment_status = p_payment_status,
      payment_provider = case
        when p_payment_status = 'paid' then 'manual'
        else null
      end
  where id::text = p_order_id;
end;
$$;

revoke all on function public.admin_set_manual_payment_status(text, text) from public;
revoke all on function public.admin_set_manual_payment_status(text, text) from anon;
grant execute on function public.admin_set_manual_payment_status(text, text) to authenticated;

notify pgrst, 'reload schema';