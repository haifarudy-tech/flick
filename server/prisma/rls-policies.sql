-- Flick — Supabase Row Level Security policies
--
-- Run this AFTER `prisma migrate deploy` creates the tables.
-- Copy/paste into Supabase SQL Editor and execute.
--
-- Model: every tenant-owned table has a business_id column. The API sets the
-- `request.jwt.claims` to include { "businessId": "<id>" } on every request,
-- and policies compare against that claim. The service role key (used only
-- server-side) bypasses RLS so the backend can write on any tenant's behalf.

-- ---------------------------------------------------------------------------
-- Helper: pull businessId out of the JWT claim
-- ---------------------------------------------------------------------------
create or replace function auth.business_id() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::json->>'businessId',
    ''
  )
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on every tenant-scoped table
-- ---------------------------------------------------------------------------
alter table "Business"                      enable row level security;
alter table "Location"                      enable row level security;
alter table "User"                          enable row level security;
alter table "RefreshToken"                  enable row level security;
alter table "Category"                      enable row level security;
alter table "MenuItem"                      enable row level security;
alter table "MenuItemModifierGroup"         enable row level security;
alter table "MenuItemModifier"              enable row level security;
alter table "Order"                         enable row level security;
alter table "OrderItem"                     enable row level security;
alter table "OrderItemModifier"             enable row level security;
alter table "Payment"                       enable row level security;
alter table "DeliveryPlatformConnection"    enable row level security;
alter table "WebhookLog"                    enable row level security;
alter table "Staff"                         enable row level security;
alter table "Shift"                         enable row level security;
alter table "Customer"                      enable row level security;
alter table "InventoryItem"                 enable row level security;
alter table "StockMovement"                 enable row level security;
alter table "Subscription"                  enable row level security;

-- ---------------------------------------------------------------------------
-- Business isolation policy (direct business_id tables)
-- ---------------------------------------------------------------------------
create policy "tenant_isolation_business" on "Business"
  for all using (id = auth.business_id());

create policy "tenant_isolation_by_business_id" on "Location"
  for all using ("businessId" = auth.business_id());

create policy "tenant_isolation_by_business_id" on "User"
  for all using ("businessId" = auth.business_id());

create policy "tenant_isolation_by_business_id" on "Category"
  for all using ("businessId" = auth.business_id());

create policy "tenant_isolation_by_business_id" on "MenuItem"
  for all using ("businessId" = auth.business_id());

create policy "tenant_isolation_by_business_id" on "Order"
  for all using ("businessId" = auth.business_id());

create policy "tenant_isolation_by_business_id" on "DeliveryPlatformConnection"
  for all using ("businessId" = auth.business_id());

create policy "tenant_isolation_by_business_id" on "Customer"
  for all using ("businessId" = auth.business_id());

create policy "tenant_isolation_by_business_id" on "InventoryItem"
  for all using ("businessId" = auth.business_id());

create policy "tenant_isolation_by_business_id" on "Subscription"
  for all using ("businessId" = auth.business_id());

create policy "tenant_isolation_by_business_id_nullable" on "WebhookLog"
  for all using ("businessId" is null or "businessId" = auth.business_id());

-- ---------------------------------------------------------------------------
-- Tables joined through a parent — match on the parent's businessId
-- ---------------------------------------------------------------------------
create policy "tenant_isolation_modifier_group" on "MenuItemModifierGroup"
  for all using (exists (
    select 1 from "MenuItem" mi
    where mi.id = "MenuItemModifierGroup"."menuItemId"
      and mi."businessId" = auth.business_id()
  ));

create policy "tenant_isolation_modifier" on "MenuItemModifier"
  for all using (exists (
    select 1 from "MenuItemModifierGroup" g
    join "MenuItem" mi on mi.id = g."menuItemId"
    where g.id = "MenuItemModifier"."groupId"
      and mi."businessId" = auth.business_id()
  ));

create policy "tenant_isolation_order_item" on "OrderItem"
  for all using (exists (
    select 1 from "Order" o
    where o.id = "OrderItem"."orderId"
      and o."businessId" = auth.business_id()
  ));

create policy "tenant_isolation_order_item_modifier" on "OrderItemModifier"
  for all using (exists (
    select 1 from "OrderItem" oi
    join "Order" o on o.id = oi."orderId"
    where oi.id = "OrderItemModifier"."orderItemId"
      and o."businessId" = auth.business_id()
  ));

create policy "tenant_isolation_payment" on "Payment"
  for all using (exists (
    select 1 from "Order" o
    where o.id = "Payment"."orderId"
      and o."businessId" = auth.business_id()
  ));

create policy "tenant_isolation_refresh_token" on "RefreshToken"
  for all using (exists (
    select 1 from "User" u
    where u.id = "RefreshToken"."userId"
      and u."businessId" = auth.business_id()
  ));

create policy "tenant_isolation_staff" on "Staff"
  for all using (exists (
    select 1 from "User" u
    where u.id = "Staff"."userId"
      and u."businessId" = auth.business_id()
  ));

create policy "tenant_isolation_shift" on "Shift"
  for all using (exists (
    select 1 from "User" u
    where u.id = "Shift"."userId"
      and u."businessId" = auth.business_id()
  ));

create policy "tenant_isolation_stock_movement" on "StockMovement"
  for all using (exists (
    select 1 from "InventoryItem" i
    where i.id = "StockMovement"."inventoryItemId"
      and i."businessId" = auth.business_id()
  ));
