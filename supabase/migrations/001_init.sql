-- NubeStock: esquema inicial multi-tienda con roles y RLS.
-- Ejecutar una sola vez en un proyecto Supabase nuevo (SQL Editor o `supabase db push`).


-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  next_sku integer not null default 1,
  next_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table public.store_members (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner', 'employee')),
  created_at timestamptz not null default now(),
  primary key (store_id, user_id)
);
create index store_members_user_idx on public.store_members (user_id);

create table public.store_invitations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  email text not null check (email = lower(trim(email)) and email like '%_@_%'),
  role text not null check (role in ('owner', 'employee')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (store_id, email)
);
create index store_invitations_email_idx on public.store_invitations (email);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  phone text not null default '' check (char_length(phone) <= 20),
  email text not null default '' check (char_length(email) <= 120),
  notes text not null default '' check (char_length(notes) <= 300),
  created_at timestamptz not null default now()
);
create index suppliers_store_idx on public.suppliers (store_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  supplier_id uuid references public.suppliers (id) on delete set null,
  name text not null check (char_length(trim(name)) between 2 and 80),
  sku text not null default '',
  category text not null default 'General' check (char_length(category) <= 40),
  unit text not null default 'und.' check (char_length(unit) <= 15),
  stock integer not null default 0 check (stock >= 0),
  min_stock integer not null default 0 check (min_stock >= 0),
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  price numeric(12, 2) not null default 0 check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, sku)
);
create index products_store_idx on public.products (store_id);

create table public.movements (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  type text not null check (type in ('in', 'out', 'adjust')),
  delta integer not null,
  stock_after integer not null check (stock_after >= 0),
  note text not null default '' check (char_length(note) <= 200),
  order_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_by_email text not null default '',
  created_at timestamptz not null default now()
);
create index movements_store_created_idx on public.movements (store_id, created_at desc);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  code text not null default '',
  supplier_id uuid references public.suppliers (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'received', 'cancelled')),
  notes text not null default '' check (char_length(notes) <= 300),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  received_at timestamptz,
  unique (store_id, code)
);
create index orders_store_created_idx on public.orders (store_id, created_at desc);

alter table public.movements
  add constraint movements_order_fk foreign key (order_id) references public.orders (id) on delete set null;

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  store_id uuid not null references public.stores (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12, 2) not null default 0 check (unit_cost >= 0),
  unique (order_id, product_id)
);
create index order_items_order_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Funciones auxiliares de permisos (security definer para evitar recursión RLS)
-- ---------------------------------------------------------------------------

create or replace function public.is_store_member(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.store_members
    where store_id = p_store_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_store_owner(p_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.store_members
    where store_id = p_store_id and user_id = auth.uid() and role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- Disparadores
-- ---------------------------------------------------------------------------

-- SKU consecutivo por tienda (NS-001) cuando no se envía uno.
create or replace function public.products_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  if coalesce(trim(new.sku), '') = '' then
    update public.stores set next_sku = next_sku + 1
      where id = new.store_id
      returning next_sku - 1 into v_next;
    new.sku := 'NS-' || lpad(v_next::text, 3, '0');
  end if;
  new.name := trim(new.name);
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_before_insert
  before insert on public.products
  for each row execute function public.products_before_insert();

-- El inventario inicial queda registrado como movimiento.
create or replace function public.products_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stock > 0 then
    insert into public.movements (store_id, product_id, type, delta, stock_after, note, created_by, created_by_email)
    values (new.store_id, new.id, 'in', new.stock, new.stock, 'Inventario inicial', auth.uid(),
            coalesce(auth.jwt() ->> 'email', ''));
  end if;
  return new;
end;
$$;

create trigger products_after_insert
  after insert on public.products
  for each row execute function public.products_after_insert();

-- Las existencias solo cambian por las funciones de movimiento; la tienda no se puede mover.
create or replace function public.products_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.store_id <> old.store_id then
    raise exception 'No se puede cambiar la tienda de un producto';
  end if;
  if new.stock <> old.stock and coalesce(current_setting('nubestock.stock_rpc', true), '') <> 'on' then
    raise exception 'Las existencias se actualizan registrando un movimiento';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_before_update
  before update on public.products
  for each row execute function public.products_before_update();

-- Consecutivo de pedido por tienda (PED-0001).
create or replace function public.orders_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  update public.stores set next_order = next_order + 1
    where id = new.store_id
    returning next_order - 1 into v_next;
  new.code := 'PED-' || lpad(v_next::text, 4, '0');
  new.status := 'draft';
  new.created_by := auth.uid();
  new.created_at := now();
  new.sent_at := null;
  new.received_at := null;
  return new;
end;
$$;

create trigger orders_before_insert
  before insert on public.orders
  for each row execute function public.orders_before_insert();

-- Estados válidos: borrador -> enviado -> recibido; cancelar desde borrador o enviado.
-- La recepción solo ocurre dentro de receive_order.
create or replace function public.orders_before_update()
returns trigger
language plpgsql
as $$
begin
  if new.store_id <> old.store_id or new.code <> old.code then
    raise exception 'No se puede cambiar la tienda o el código del pedido';
  end if;
  if new.status <> old.status then
    if old.status in ('received', 'cancelled') then
      raise exception 'El pedido ya está cerrado';
    end if;
    if new.status = 'received' and coalesce(current_setting('nubestock.stock_rpc', true), '') <> 'on' then
      raise exception 'Usa la opción Recibir pedido para actualizar el inventario';
    end if;
    if new.status = 'sent' and old.status <> 'draft' then
      raise exception 'Solo un borrador se puede marcar como enviado';
    end if;
    if new.status = 'draft' then
      raise exception 'Un pedido no puede volver a borrador';
    end if;
    if new.status = 'sent' then
      new.sent_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger orders_before_update
  before update on public.orders
  for each row execute function public.orders_before_update();

-- El renglón del pedido hereda la tienda del pedido y solo se edita en borrador.
create or replace function public.order_items_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_product_store uuid;
begin
  -- Borrados en cascada (tienda, pedido o producto eliminados) no se bloquean.
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  select * into v_order from public.orders where id = coalesce(new.order_id, old.order_id);
  if v_order.status <> 'draft' then
    raise exception 'Solo se pueden editar pedidos en borrador';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  select store_id into v_product_store from public.products where id = new.product_id;
  if v_product_store is distinct from v_order.store_id then
    raise exception 'El producto no pertenece a la tienda';
  end if;
  new.store_id := v_order.store_id;
  return new;
end;
$$;

create trigger order_items_guard
  before insert or update or delete on public.order_items
  for each row execute function public.order_items_guard();

-- Una tienda no puede quedarse sin propietario.
create or replace function public.store_members_keep_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and pg_trigger_depth() > 1 then
    return old;
  end if;
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (
       select 1 from public.store_members
       where store_id = old.store_id and role = 'owner' and user_id <> old.user_id
     ) then
    raise exception 'La tienda debe tener al menos un propietario';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger store_members_keep_owner
  before update or delete on public.store_members
  for each row execute function public.store_members_keep_owner();

-- Un producto o pedido solo puede usar proveedores de su misma tienda.
create or replace function public.check_supplier_store()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.supplier_id is not null and not exists (
    select 1 from public.suppliers where id = new.supplier_id and store_id = new.store_id
  ) then
    raise exception 'El proveedor no pertenece a la tienda';
  end if;
  return new;
end;
$$;

create trigger products_supplier_store
  before insert or update of supplier_id on public.products
  for each row execute function public.check_supplier_store();

create trigger orders_supplier_store
  before insert or update of supplier_id on public.orders
  for each row execute function public.check_supplier_store();

-- ---------------------------------------------------------------------------
-- Funciones RPC
-- ---------------------------------------------------------------------------

create or replace function public.create_store(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_store uuid;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para crear una tienda';
  end if;
  if (select count(*) from public.store_members where user_id = auth.uid() and role = 'owner') >= 5 then
    raise exception 'Puedes administrar máximo 5 tiendas';
  end if;
  insert into public.stores (name) values (trim(p_name)) returning id into v_store;
  insert into public.store_members (store_id, user_id, email, role)
  values (v_store, auth.uid(), lower(coalesce(auth.jwt() ->> 'email', '')), 'owner');
  return v_store;
end;
$$;

-- Une al usuario a las tiendas que lo invitaron por correo.
create or replace function public.accept_invitations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_count integer := 0;
begin
  if auth.uid() is null or v_email = '' then
    return 0;
  end if;
  insert into public.store_members (store_id, user_id, email, role)
  select i.store_id, auth.uid(), v_email, i.role
  from public.store_invitations i
  where i.email = v_email
  on conflict (store_id, user_id) do nothing;
  get diagnostics v_count = row_count;
  delete from public.store_invitations where email = v_email;
  return v_count;
end;
$$;

-- Registra una venta (out), una compra (in) o un conteo físico (adjust = cantidad real contada).
create or replace function public.register_movement(
  p_product_id uuid,
  p_type text,
  p_quantity integer,
  p_note text default ''
)
returns public.movements
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products;
  v_delta integer;
  v_after integer;
  v_movement public.movements;
begin
  select * into v_product from public.products where id = p_product_id for update;
  if not found or not public.is_store_member(v_product.store_id) then
    raise exception 'Producto no encontrado';
  end if;
  if p_type not in ('in', 'out', 'adjust') then
    raise exception 'Tipo de movimiento no válido';
  end if;
  if p_quantity is null or p_quantity < 0 or (p_type <> 'adjust' and p_quantity = 0) then
    raise exception 'La cantidad debe ser mayor que cero';
  end if;
  if p_quantity > 100000 then
    raise exception 'La cantidad es demasiado grande';
  end if;

  v_delta := case p_type
    when 'in' then p_quantity
    when 'out' then -p_quantity
    else p_quantity - v_product.stock
  end;
  v_after := v_product.stock + v_delta;
  if v_after < 0 then
    raise exception 'No hay suficientes unidades de % (disponibles: %)', v_product.name, v_product.stock;
  end if;
  if v_delta = 0 then
    raise exception 'El conteo coincide con las existencias; no hay nada que ajustar';
  end if;

  perform set_config('nubestock.stock_rpc', 'on', true);
  update public.products set stock = v_after where id = v_product.id;
  perform set_config('nubestock.stock_rpc', 'off', true);

  insert into public.movements (store_id, product_id, type, delta, stock_after, note, created_by, created_by_email)
  values (v_product.store_id, v_product.id, p_type, v_delta, v_after, left(trim(coalesce(p_note, '')), 200),
          auth.uid(), lower(coalesce(auth.jwt() ->> 'email', '')))
  returning * into v_movement;
  return v_movement;
end;
$$;

-- Recibe un pedido enviado: suma existencias, crea movimientos y actualiza el costo.
create or replace function public.receive_order(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item record;
  v_after integer;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or not public.is_store_member(v_order.store_id) then
    raise exception 'Pedido no encontrado';
  end if;
  if v_order.status <> 'sent' then
    raise exception 'Solo se puede recibir un pedido enviado';
  end if;

  perform set_config('nubestock.stock_rpc', 'on', true);
  for v_item in
    select oi.*, p.stock from public.order_items oi
    join public.products p on p.id = oi.product_id
    where oi.order_id = v_order.id
    for update of p
  loop
    v_after := v_item.stock + v_item.quantity;
    update public.products
      set stock = v_after,
          cost = case when v_item.unit_cost > 0 then v_item.unit_cost else cost end
      where id = v_item.product_id;
    insert into public.movements (store_id, product_id, type, delta, stock_after, note, order_id, created_by, created_by_email)
    values (v_order.store_id, v_item.product_id, 'in', v_item.quantity, v_after, 'Recepción de ' || v_order.code,
            v_order.id, auth.uid(), lower(coalesce(auth.jwt() ->> 'email', '')));
  end loop;

  update public.orders set status = 'received', received_at = now() where id = v_order.id
    returning * into v_order;
  perform set_config('nubestock.stock_rpc', 'off', true);
  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.store_invitations enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.movements enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy stores_select on public.stores for select to authenticated
  using (public.is_store_member(id));
create policy stores_update on public.stores for update to authenticated
  using (public.is_store_owner(id)) with check (public.is_store_owner(id));
create policy stores_delete on public.stores for delete to authenticated
  using (public.is_store_owner(id));

create policy members_select on public.store_members for select to authenticated
  using (public.is_store_member(store_id));
create policy members_update on public.store_members for update to authenticated
  using (public.is_store_owner(store_id)) with check (public.is_store_owner(store_id));
create policy members_delete on public.store_members for delete to authenticated
  using (public.is_store_owner(store_id) or user_id = auth.uid());

create policy invitations_select on public.store_invitations for select to authenticated
  using (public.is_store_owner(store_id));
create policy invitations_insert on public.store_invitations for insert to authenticated
  with check (public.is_store_owner(store_id) and invited_by = auth.uid());
create policy invitations_delete on public.store_invitations for delete to authenticated
  using (public.is_store_owner(store_id));

create policy suppliers_select on public.suppliers for select to authenticated
  using (public.is_store_member(store_id));
create policy suppliers_insert on public.suppliers for insert to authenticated
  with check (public.is_store_owner(store_id));
create policy suppliers_update on public.suppliers for update to authenticated
  using (public.is_store_owner(store_id)) with check (public.is_store_owner(store_id));
create policy suppliers_delete on public.suppliers for delete to authenticated
  using (public.is_store_owner(store_id));

create policy products_select on public.products for select to authenticated
  using (public.is_store_member(store_id));
create policy products_insert on public.products for insert to authenticated
  with check (public.is_store_owner(store_id));
create policy products_update on public.products for update to authenticated
  using (public.is_store_owner(store_id)) with check (public.is_store_owner(store_id));

create policy movements_select on public.movements for select to authenticated
  using (public.is_store_member(store_id));

create policy orders_select on public.orders for select to authenticated
  using (public.is_store_member(store_id));
create policy orders_insert on public.orders for insert to authenticated
  with check (public.is_store_owner(store_id));
create policy orders_update on public.orders for update to authenticated
  using (public.is_store_owner(store_id)) with check (public.is_store_owner(store_id));
create policy orders_delete on public.orders for delete to authenticated
  using (public.is_store_owner(store_id) and status = 'draft');

create policy order_items_select on public.order_items for select to authenticated
  using (public.is_store_member(store_id));
create policy order_items_insert on public.order_items for insert to authenticated
  with check (public.is_store_owner(store_id));
create policy order_items_update on public.order_items for update to authenticated
  using (public.is_store_owner(store_id)) with check (public.is_store_owner(store_id));
create policy order_items_delete on public.order_items for delete to authenticated
  using (public.is_store_owner(store_id));

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.is_store_member(uuid),
  public.is_store_owner(uuid),
  public.create_store(text),
  public.accept_invitations(),
  public.register_movement(uuid, text, integer, text),
  public.receive_order(uuid)
to authenticated;

-- Los movimientos solo se crean con las funciones: sin insert/update/delete directo.
revoke insert, update, delete on public.movements from authenticated;
-- Las columnas de consecutivos solo las cambian los disparadores.
revoke update on public.stores from authenticated;
grant update (name) on public.stores to authenticated;
revoke update on public.store_members from authenticated;
grant update (role) on public.store_members to authenticated;
revoke update on public.order_items from authenticated;
grant update (quantity, unit_cost) on public.order_items to authenticated;
