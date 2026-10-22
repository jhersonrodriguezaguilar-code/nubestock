// Prueba la migración de NubeStock en un Postgres embebido con un entorno parecido a Supabase.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const migration = readFileSync(new URL("../migrations/001_init.sql", import.meta.url), "utf8");
const db = new PGlite();

await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
  insert into auth.users values
    ('00000000-0000-0000-0000-00000000000a', 'a@test.co'),
    ('00000000-0000-0000-0000-00000000000b', 'b@test.co'),
    ('00000000-0000-0000-0000-00000000000c', 'c@test.co');
`);
await db.exec(migration);

const users = {
  a: { sub: "00000000-0000-0000-0000-00000000000a", email: "a@test.co" },
  b: { sub: "00000000-0000-0000-0000-00000000000b", email: "b@test.co" },
  c: { sub: "00000000-0000-0000-0000-00000000000c", email: "c@test.co" },
};

let failures = 0;
const as = async (who, sql, params = []) => {
  await db.exec("reset role");
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [who ? JSON.stringify(users[who]) : ""]);
  await db.exec(`set role ${who ? "authenticated" : "anon"}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
};
const ok = async (name, fn) => {
  try {
    await fn();
    console.log("  ok  ", name);
  } catch (error) {
    failures += 1;
    console.log("  FALLA", name, "->", error.message);
  }
};
const expectError = async (name, fn, pattern) =>
  ok(name, async () => {
    try {
      await fn();
    } catch (error) {
      if (pattern && !pattern.test(error.message)) throw new Error(`error inesperado: ${error.message}`);
      return;
    }
    throw new Error("se esperaba un error");
  });
const eq = (actual, expected, label = "") => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} esperado ${JSON.stringify(expected)}, llegó ${JSON.stringify(actual)}`);
};

let store, product, product2, order;

console.log("Tiendas y productos");
await ok("A crea su tienda y queda como propietario", async () => {
  store = (await as("a", "select public.create_store('Tienda A') as id")).rows[0].id;
  eq((await as("a", "select role from store_members where store_id = $1", [store])).rows, [{ role: "owner" }]);
});
await ok("SKU consecutivo e inventario inicial como movimiento", async () => {
  product = (await as("a", "insert into products (store_id, name, stock, min_stock, price) values ($1, 'Arroz', 10, 4, 4600) returning id, sku", [store])).rows[0];
  product2 = (await as("a", "insert into products (store_id, name, stock) values ($1, 'Leche', 0) returning id, sku", [store])).rows[0];
  eq([product.sku, product2.sku], ["NS-001", "NS-002"]);
  eq((await as("a", "select type, delta, note from movements where product_id = $1", [product.id])).rows, [{ type: "in", delta: 10, note: "Inventario inicial" }]);
});
await ok("Venta descuenta existencias", async () => {
  const row = (await as("a", "select * from public.register_movement($1, 'out', 3, 'mostrador')", [product.id])).rows[0];
  eq([row.delta, row.stock_after, row.created_by_email], [-3, 7, "a@test.co"]);
});
await expectError("No permite vender más de lo disponible", () => as("a", "select public.register_movement($1, 'out', 8)", [product.id]), /No hay suficientes/);
await ok("Conteo físico ajusta al valor contado", async () => {
  eq((await as("a", "select delta, stock_after from public.register_movement($1, 'adjust', 5)", [product.id])).rows[0], { delta: -2, stock_after: 5 });
});
await expectError("No se puede cambiar stock con update directo", () => as("a", "update products set stock = 99 where id = $1", [product.id]), /movimiento/);
await expectError("No se pueden insertar movimientos directos", () => as("a", "insert into movements (store_id, product_id, type, delta, stock_after) values ($1, $2, 'in', 5, 5)", [store, product.id]), /permission denied/);
await ok("El propietario sí edita precio y mínimo", async () => {
  await as("a", "update products set price = 5000, min_stock = 6 where id = $1", [product.id]);
  eq((await as("a", "select price::int, stock from products where id = $1", [product.id])).rows[0], { price: 5000, stock: 5 });
});
await expectError("No se cambia el consecutivo de la tienda", () => as("a", "update stores set next_sku = 1 where id = $1", [store]), /permission denied/);

console.log("Aislamiento entre tiendas");
await ok("B no ve la tienda ni los productos de A", async () => {
  eq((await as("b", "select count(*)::int as n from stores")).rows[0].n, 0);
  eq((await as("b", "select count(*)::int as n from products")).rows[0].n, 0);
  eq((await as("b", "select count(*)::int as n from movements")).rows[0].n, 0);
});
await expectError("B no puede registrar movimientos en productos de A", () => as("b", "select public.register_movement($1, 'out', 1)", [product.id]), /no encontrado/);
await expectError("B no puede crear productos en la tienda de A", () => as("b", "insert into products (store_id, name) values ($1, 'X')", [store]), /row-level security/);
await ok("B no puede editar productos de A (0 filas)", async () => {
  eq((await as("b", "update products set price = 1 where id = $1", [product.id])).affectedRows, 0);
});
await expectError("B no puede unirse solo a la tienda de A", () => as("b", "insert into store_members (store_id, user_id, email, role) values ($1, $2, 'b@test.co', 'owner')", [store, users.b.sub]), /row-level security/);
await expectError("Anónimo no puede crear tiendas", () => as(null, "select public.create_store('X')"), /permission denied/);
await ok("Anónimo no ve productos", async () => {
  try {
    const rows = (await as(null, "select count(*)::int as n from products")).rows;
    eq(rows[0].n, 0);
  } catch (error) {
    if (!/permission denied/.test(error.message)) throw error;
  }
});

console.log("Equipo y roles");
await expectError("B no puede invitarse a la tienda de A", () => as("b", "insert into store_invitations (store_id, email, role, invited_by) values ($1, 'b@test.co', 'owner', $2)", [store, users.b.sub]), /row-level security/);
await ok("A invita a B como empleado y B acepta al entrar", async () => {
  await as("a", "insert into store_invitations (store_id, email, role, invited_by) values ($1, 'b@test.co', 'employee', $2)", [store, users.a.sub]);
  eq((await as("b", "select public.accept_invitations() as n")).rows[0].n, 1);
  eq((await as("b", "select role from store_members where store_id = $1 and user_id = $2", [store, users.b.sub])).rows, [{ role: "employee" }]);
  eq((await as("b", "select count(*)::int as n from store_invitations")).rows[0].n, 0);
});
await ok("Empleado ve productos y registra ventas", async () => {
  eq((await as("b", "select count(*)::int as n from products")).rows[0].n, 2);
  eq((await as("b", "select stock_after from public.register_movement($1, 'out', 1)", [product.id])).rows[0].stock_after, 4);
});
await expectError("Empleado no crea productos", () => as("b", "insert into products (store_id, name) values ($1, 'X')", [store]), /row-level security/);
await ok("Empleado no edita precios (0 filas)", async () => {
  eq((await as("b", "update products set price = 1 where id = $1", [product.id])).affectedRows, 0);
});
await ok("Empleado no se cambia el rol (0 filas)", async () => {
  eq((await as("b", "update store_members set role = 'owner' where user_id = $1", [users.b.sub])).affectedRows, 0);
});
await expectError("Empleado no crea pedidos", () => as("b", "insert into orders (store_id) values ($1)", [store]), /row-level security/);

console.log("Pedidos");
await ok("A crea pedido con código consecutivo y renglones", async () => {
  order = (await as("a", "insert into orders (store_id, notes, status, code) values ($1, 'nota', 'received', 'X') returning id, code, status", [store])).rows[0];
  eq([order.code, order.status], ["PED-0001", "draft"]);
  await as("a", "insert into order_items (order_id, store_id, product_id, quantity, unit_cost) values ($1, $2, $3, 12, 3900), ($1, $2, $4, 6, 3500)", [order.id, store, product.id, product2.id]);
});
await expectError("No se puede recibir un borrador", () => as("a", "select public.receive_order($1)", [order.id]), /enviado/);
await expectError("No se marca recibido sin la función", () => as("a", "update orders set status = 'received' where id = $1", [order.id]), /Recibir pedido/);
await ok("A envía el pedido", async () => {
  await as("a", "update orders set status = 'sent' where id = $1", [order.id]);
});
await expectError("No se editan renglones de un pedido enviado", () => as("a", "update order_items set quantity = 1 where order_id = $1", [order.id]), /borrador/);
await ok("Empleado recibe: suben existencias y se actualiza el costo", async () => {
  await as("b", "select public.receive_order($1)", [order.id]);
  eq((await as("b", "select name, stock, cost::int from products order by name")).rows, [
    { name: "Arroz", stock: 16, cost: 3900 },
    { name: "Leche", stock: 6, cost: 3500 },
  ]);
  eq((await as("b", "select count(*)::int as n from movements where order_id = $1", [order.id])).rows[0].n, 2);
});
await expectError("No se recibe dos veces", () => as("a", "select public.receive_order($1)", [order.id]), /enviado/);
await expectError("No se reabre un pedido recibido", () => as("a", "update orders set status = 'cancelled' where id = $1", [order.id]), /cerrado/);
await ok("No se borra un pedido recibido (0 filas)", async () => {
  eq((await as("a", "delete from orders where id = $1", [order.id])).affectedRows, 0);
});
await ok("Producto de otra tienda no entra al pedido", async () => {
  const other = (await as("c", "select public.create_store('Tienda C') as id")).rows[0].id;
  const foreign = (await as("c", "insert into products (store_id, name) values ($1, 'Ajeno') returning id", [other])).rows[0].id;
  const draft = (await as("a", "insert into orders (store_id) values ($1) returning id", [store])).rows[0].id;
  let blocked = false;
  try {
    await as("a", "insert into order_items (order_id, store_id, product_id, quantity) values ($1, $2, $3, 1)", [draft, store, foreign]);
  } catch {
    blocked = true;
  }
  if (!blocked) throw new Error("se agregó un producto de otra tienda");
  await as("a", "delete from orders where id = $1", [draft]);
});

await ok("No se asigna un proveedor de otra tienda", async () => {
  const other = (await as("c", "select id from stores limit 1")).rows[0].id;
  const foreignSupplier = (await as("c", "insert into suppliers (store_id, name) values ($1, 'Proveedor C') returning id", [other])).rows[0].id;
  let blocked = 0;
  for (const sql of [
    "update products set supplier_id = $2 where id = $1",
    "insert into orders (store_id, supplier_id) values ((select store_id from products where id = $1), $2)",
  ]) {
    try {
      await as("a", sql, [product.id, foreignSupplier]);
    } catch (error) {
      if (/no pertenece/.test(error.message)) blocked += 1;
    }
  }
  eq(blocked, 2, "bloqueos");
});

console.log("Propietarios y borrado");
await expectError("El único propietario no puede salir", () => as("a", "delete from store_members where store_id = $1 and user_id = $2", [store, users.a.sub]), /propietario/);
await ok("Empleado puede salir de la tienda", async () => {
  eq((await as("b", "delete from store_members where store_id = $1 and user_id = $2", [store, users.b.sub])).affectedRows, 1);
  eq((await as("b", "select count(*)::int as n from products")).rows[0].n, 0);
});
await ok("El propietario borra la tienda y todo se elimina en cascada", async () => {
  eq((await as("a", "delete from stores where id = $1", [store])).affectedRows, 1);
  await db.exec("reset role");
  eq((await db.query("select count(*)::int as n from products where store_id = $1", [store])).rows[0].n, 0);
  eq((await db.query("select count(*)::int as n from order_items where store_id = $1", [store])).rows[0].n, 0);
});

console.log(failures ? `\n${failures} pruebas fallaron` : "\nTodas las pruebas pasaron");
process.exit(failures ? 1 : 0);
