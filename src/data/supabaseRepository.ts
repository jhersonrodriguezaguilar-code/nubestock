import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Repository, SessionUser } from "./repository";
import type { Movement, Order, OrderInput, Product, ProductInput, Role, Supplier, SupplierInput } from "../types";

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  stock: number;
  min_stock: number;
  cost: number | string;
  price: number | string;
  supplier_id: string | null;
  active: boolean;
  updated_at: string;
};

type MovementRow = {
  id: string;
  product_id: string;
  type: Movement["type"];
  delta: number;
  stock_after: number;
  note: string;
  order_id: string | null;
  created_by_email: string;
  created_at: string;
};

type OrderRow = {
  id: string;
  code: string;
  supplier_id: string | null;
  status: Order["status"];
  notes: string;
  created_at: string;
  sent_at: string | null;
  received_at: string | null;
  order_items: { product_id: string; quantity: number; unit_cost: number | string }[];
};

const toProduct = (row: ProductRow): Product => ({
  id: row.id,
  name: row.name,
  sku: row.sku,
  category: row.category,
  unit: row.unit,
  stock: row.stock,
  minStock: row.min_stock,
  cost: Number(row.cost),
  price: Number(row.price),
  supplierId: row.supplier_id,
  active: row.active,
  updatedAt: row.updated_at,
});

const toMovement = (row: MovementRow): Movement => ({
  id: row.id,
  productId: row.product_id,
  type: row.type,
  delta: row.delta,
  stockAfter: row.stock_after,
  note: row.note,
  orderId: row.order_id,
  createdByEmail: row.created_by_email,
  createdAt: row.created_at,
});

const toOrder = (row: OrderRow): Order => ({
  id: row.id,
  code: row.code,
  supplierId: row.supplier_id,
  status: row.status,
  notes: row.notes,
  createdAt: row.created_at,
  sentAt: row.sent_at,
  receivedAt: row.received_at,
  items: (row.order_items ?? []).map((item) => ({
    productId: item.product_id,
    quantity: item.quantity,
    unitCost: Number(item.unit_cost),
  })),
});

const productColumns = "id,name,sku,category,unit,stock,min_stock,cost,price,supplier_id,active,updated_at";
const orderColumns = "id,code,supplier_id,status,notes,created_at,sent_at,received_at,order_items(product_id,quantity,unit_cost)";
/** Historial que se carga por tienda; suficiente para los reportes de 30 días. */
const MOVEMENT_LIMIT = 1000;

const check = (result: { data?: unknown; error: unknown }): unknown => {
  if (result.error) throw result.error;
  return result.data;
};

/** URL a la que vuelven los correos de confirmación y recuperación (sin el hash de la ruta). */
const redirectUrl = () => `${window.location.origin}${window.location.pathname}`;

export class SupabaseRepository implements Repository {
  readonly mode = "cloud" as const;
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, {
      auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }

  async getUser(): Promise<SessionUser | null> {
    const { data } = await this.client.auth.getSession();
    const user = data.session?.user;
    return user ? { id: user.id, email: user.email ?? "" } : null;
  }

  onAuthChange(callback: (user: SessionUser | null, event: string) => void) {
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      const user = session?.user;
      callback(user ? { id: user.id, email: user.email ?? "" } : null, event);
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string) {
    check(await this.client.auth.signInWithPassword({ email, password }));
  }

  async signUp(email: string, password: string) {
    const data = check(
      await this.client.auth.signUp({ email, password, options: { emailRedirectTo: redirectUrl() } }),
    );
    return { needsConfirmation: !(data as { session: unknown }).session };
  }

  async sendPasswordReset(email: string) {
    check(await this.client.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl() }));
  }

  async updatePassword(password: string) {
    check(await this.client.auth.updateUser({ password }));
  }

  async signOut() {
    check(await this.client.auth.signOut());
  }

  async listStores() {
    check(await this.client.rpc("accept_invitations"));
    const user = await this.getUser();
    if (!user) return [];
    const rows = check(
      await this.client
        .from("store_members")
        .select("role, stores(id, name)")
        .eq("user_id", user.id)
        .order("created_at"),
    ) as unknown as { role: Role; stores: { id: string; name: string } | null }[];
    return rows
      .filter((row) => row.stores)
      .map((row) => ({ id: row.stores!.id, name: row.stores!.name, role: row.role }));
  }

  async createStore(name: string) {
    return check(await this.client.rpc("create_store", { p_name: name })) as string;
  }

  async renameStore(storeId: string, name: string) {
    check(await this.client.from("stores").update({ name }).eq("id", storeId));
  }

  async loadStore(storeId: string) {
    const [products, movements, orders, suppliers] = await Promise.all([
      this.client.from("products").select(productColumns).eq("store_id", storeId).order("name"),
      this.client
        .from("movements")
        .select("id,product_id,type,delta,stock_after,note,order_id,created_by_email,created_at")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(MOVEMENT_LIMIT),
      this.client.from("orders").select(orderColumns).eq("store_id", storeId).order("created_at", { ascending: false }),
      this.client.from("suppliers").select("id,name,phone,email,notes").eq("store_id", storeId).order("name"),
    ]);
    return {
      products: (check(products) as ProductRow[]).map(toProduct),
      movements: (check(movements) as MovementRow[]).map(toMovement),
      orders: (check(orders) as OrderRow[]).map(toOrder),
      suppliers: check(suppliers) as Supplier[],
    };
  }

  async createProduct(storeId: string, input: ProductInput) {
    const row = check(
      await this.client
        .from("products")
        .insert({
          store_id: storeId,
          name: input.name,
          category: input.category,
          unit: input.unit,
          stock: input.stock,
          min_stock: input.minStock,
          cost: input.cost,
          price: input.price,
          supplier_id: input.supplierId,
        })
        .select(productColumns)
        .single(),
    ) as ProductRow;
    return toProduct(row);
  }

  async updateProduct(storeId: string, productId: string, input: Omit<ProductInput, "stock"> & { active?: boolean }) {
    check(
      await this.client
        .from("products")
        .update({
          name: input.name,
          category: input.category,
          unit: input.unit,
          min_stock: input.minStock,
          cost: input.cost,
          price: input.price,
          supplier_id: input.supplierId,
          ...(input.active === undefined ? {} : { active: input.active }),
        })
        .eq("id", productId)
        .eq("store_id", storeId),
    );
  }

  async registerMovement(_storeId: string, productId: string, type: Movement["type"], quantity: number, note: string) {
    const row = check(
      await this.client.rpc("register_movement", {
        p_product_id: productId,
        p_type: type,
        p_quantity: quantity,
        p_note: note,
      }),
    ) as MovementRow;
    return toMovement(row);
  }

  async createSupplier(storeId: string, input: SupplierInput) {
    return check(
      await this.client
        .from("suppliers")
        .insert({ store_id: storeId, ...input })
        .select("id,name,phone,email,notes")
        .single(),
    ) as Supplier;
  }

  async updateSupplier(storeId: string, supplierId: string, input: SupplierInput) {
    check(await this.client.from("suppliers").update(input).eq("id", supplierId).eq("store_id", storeId));
  }

  async deleteSupplier(storeId: string, supplierId: string) {
    check(await this.client.from("suppliers").delete().eq("id", supplierId).eq("store_id", storeId));
  }

  private async insertItems(storeId: string, orderId: string, input: OrderInput) {
    if (!input.items.length) return;
    check(
      await this.client.from("order_items").insert(
        input.items.map((item) => ({
          order_id: orderId,
          store_id: storeId,
          product_id: item.productId,
          quantity: item.quantity,
          unit_cost: item.unitCost,
        })),
      ),
    );
  }

  async createOrder(storeId: string, input: OrderInput) {
    const row = check(
      await this.client
        .from("orders")
        .insert({ store_id: storeId, supplier_id: input.supplierId, notes: input.notes })
        .select("id")
        .single(),
    ) as { id: string };
    try {
      await this.insertItems(storeId, row.id, input);
    } catch (error) {
      await this.client.from("orders").delete().eq("id", row.id);
      throw error;
    }
    const order = check(await this.client.from("orders").select(orderColumns).eq("id", row.id).single()) as OrderRow;
    return toOrder(order);
  }

  async updateOrderDraft(storeId: string, orderId: string, input: OrderInput) {
    check(
      await this.client
        .from("orders")
        .update({ supplier_id: input.supplierId, notes: input.notes })
        .eq("id", orderId)
        .eq("store_id", storeId),
    );
    check(await this.client.from("order_items").delete().eq("order_id", orderId));
    await this.insertItems(storeId, orderId, input);
  }

  async deleteOrderDraft(storeId: string, orderId: string) {
    check(await this.client.from("orders").delete().eq("id", orderId).eq("store_id", storeId));
  }

  async sendOrder(storeId: string, orderId: string) {
    check(await this.client.from("orders").update({ status: "sent" }).eq("id", orderId).eq("store_id", storeId));
  }

  async cancelOrder(storeId: string, orderId: string) {
    check(await this.client.from("orders").update({ status: "cancelled" }).eq("id", orderId).eq("store_id", storeId));
  }

  async receiveOrder(_storeId: string, orderId: string) {
    check(await this.client.rpc("receive_order", { p_order_id: orderId }));
  }

  async listMembers(storeId: string) {
    const [members, invitations] = await Promise.all([
      this.client.from("store_members").select("user_id,email,role,created_at").eq("store_id", storeId).order("created_at"),
      this.client.from("store_invitations").select("id,email,role,created_at").eq("store_id", storeId).order("created_at"),
    ]);
    return {
      members: (check(members) as { user_id: string; email: string; role: Role; created_at: string }[]).map((row) => ({
        userId: row.user_id,
        email: row.email,
        role: row.role,
        createdAt: row.created_at,
      })),
      // Un empleado no ve invitaciones (RLS devuelve una lista vacía).
      invitations: (check(invitations) as { id: string; email: string; role: Role; created_at: string }[]).map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role,
        createdAt: row.created_at,
      })),
    };
  }

  async inviteMember(storeId: string, email: string, role: Role) {
    const user = await this.getUser();
    check(
      await this.client
        .from("store_invitations")
        .insert({ store_id: storeId, email: email.trim().toLowerCase(), role, invited_by: user?.id }),
    );
  }

  async cancelInvitation(storeId: string, invitationId: string) {
    check(await this.client.from("store_invitations").delete().eq("id", invitationId).eq("store_id", storeId));
  }

  async updateMemberRole(storeId: string, userId: string, role: Role) {
    check(await this.client.from("store_members").update({ role }).eq("store_id", storeId).eq("user_id", userId));
  }

  async removeMember(storeId: string, userId: string) {
    check(await this.client.from("store_members").delete().eq("store_id", storeId).eq("user_id", userId));
  }
}
