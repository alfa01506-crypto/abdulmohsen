alter table public.orders
  alter column delivery_address drop not null,
  alter column city drop not null;

alter table public.orders
  drop constraint if exists orders_payment_method_check;

notify pgrst, 'reload schema';