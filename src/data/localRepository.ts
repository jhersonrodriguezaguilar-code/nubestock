import { applyMovement } from "../domain/inventory";
import type { Repository, SessionUser } from "./repository";
import type {
  Invitation,
  Member,
  Movement,
  MovementType,
  Order,
  OrderInput,
  Product,
  ProductInput,
  Role,
  Store,
  StoreData,
  Supplier,
  SupplierInput,
} from "../types";

/**
 * Modo demostración: los mismos casos de uso que la nube, guardados en este navegador.
 * Sirve para presentar la app sin configurar Supabase; no comparte datos entre equipos.
 */

type DemoStore = StoreData & {
  id: string;
  name: string;
  nextSku: number;
  nextOrder: number;
  members: Member[];
  invitations: Invitation[];
};

type DemoDatabase = { version: 1; stores: DemoStore[] };

const DB_KEY = "nubestock.demo.v1";
const SESSION_KEY = "nubestock.demo.session";
const DEMO_USER: SessionUser = { id: "demo-owner", email: "propietario@demo.nubestock" };

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const now = () => new Date().toISOString();
const daysAgo = (days: number, hour = 10) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 15, 0, 0);
  return date.toISOString();
};

const safeStorage = {
  get(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Sin almacenamiento disponible (modo privado): los datos viven solo en memoria.
    }
  },
  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignorado a propósito.
    }
  },
};

export const seedStore = (): DemoStore => {
  const suppliers: Supplier[] = [
    { id: "sup-1", name: "Distribuciones La 14", phone: "3105550101", email: "", notes: "Visita los lunes" },
    { id: "sup-2", name: "Lácteos del Valle", phone: "3155550102", email: "", notes: "" },
    { id: "sup-3", name: "Bebidas del Caribe", phone: "3005550103", email: "", notes: "" },
    { id: "sup-4", name: "Panificadora Central", phone: "3205550104", email: "", notes: "Entrega diaria 6 a. m." },
    { id: "sup-5", name: "Hogar y Más", phone: "", email: "", notes: "" },
  ];
  const base: [string, string, string, number, number, number, number, string][] = [
    ["Arroz 1 kg", "Abarrotes", "und.", 24, 12, 3900, 4600, "sup-1"],
    ["Aceite vegetal 1 L", "Abarrotes", "und.", 7, 10, 7600, 8900, "sup-1"],
    ["Leche entera 1 L", "Lácteos", "und.", 4, 10, 3500, 4200, "sup-2"],
    ["Gaseosa cola 1.5 L", "Bebidas", "und.", 18, 8, 5200, 6500, "sup-3"],
    ["Pan tajado blanco", "Panadería", "und.", 3, 8, 4400, 5600, "sup-4"],
    ["Café molido 250 g", "Abarrotes", "und.", 15, 8, 9300, 11200, "sup-1"],
    ["Jabón lavaplatos 500 ml", "Aseo", "und.", 9, 6, 5800, 7200, "sup-5"],
    ["Huevos AA x 12", "Lácteos", "cubeta", 6, 8, 12500, 14800, "sup-2"],
    ["Papas naturales 100 g", "Snacks", "und.", 32, 12, 2100, 2800, "sup-3"],
    ["Agua sin gas 600 ml", "Bebidas", "und.", 28, 10, 1500, 2200, "sup-3"],
  ];
  const products: Product[] = base.map(([name, category, unit, stock, minStock, cost, price, supplierId], index) => ({
    id: `prod-${index + 1}`,
    name,
    sku: `NS-${String(index + 1).padStart(3, "0")}`,
    category,
    unit,
    stock,
    minStock,
    cost,
    price,
    supplierId,
    active: true,
    updatedAt: daysAgo(index % 4),
  }));
  const history: [string, MovementType, number, number, string, number][] = [
    ["prod-3", "out", -3, 4, "Mostrador", 0],
    ["prod-5", "out", -5, 3, "Mostrador", 0],
    ["prod-4", "out", -2, 18, "Mostrador", 0],
    ["prod-2", "out", -4, 7, "Mostrador", 1],
    ["prod-9", "out", -6, 32, "Mostrador", 1],
    ["prod-1", "in", 18, 24, "Mayorista", 2],
    ["prod-8", "out", -4, 6, "Mostrador", 2],
    ["prod-10", "out", -5, 28, "Mostrador", 3],
    ["prod-6", "in", 12, 15, "Mayorista", 3],
    ["prod-4", "out", -3, 20, "Mostrador", 4],
    ["prod-7", "adjust", -1, 9, "Conteo semanal", 5],
    ["prod-3", "out", -6, 7, "Mostrador", 6],
  ];
  const movements: Movement[] = history.map(([productId, type, delta, stockAfter, note, days], index) => ({
    id: `mov-${index + 1}`,
    productId,
    type,
    delta,
    stockAfter,
    note,
    orderId: null,
    createdByEmail: DEMO_USER.email,
    createdAt: daysAgo(days, 18 - index),
  }));
  const orders: Order[] = [
    {
      id: "ord-2",
      code: "PED-0002",
      supplierId: "sup-2",
      status: "sent",
      notes: "Entregar antes de las 9 a. m.",
      createdAt: daysAgo(0, 8),
      sentAt: daysAgo(0, 8),
      receivedAt: null,
      items: [
        { productId: "prod-3", quantity: 18, unitCost: 3500 },
        { productId: "prod-8", quantity: 6, unitCost: 12500 },
      ],
    },
    {
      id: "ord-1",
      code: "PED-0001",
      supplierId: "sup-4",
      status: "draft",
      notes: "",
      createdAt: daysAgo(1, 17),
      sentAt: null,
      receivedAt: null,
      items: [{ productId: "prod-5", quantity: 12, unitCost: 4400 }],
    },
  ];
  return {
    id: "demo-store",
    name: "Tienda La Esquina",
    nextSku: products.length + 1,
    nextOrder: 3,
    products,
    movements,
    orders,
    suppliers,
    members: [{ userId: DEMO_USER.id, email: DEMO_USER.email, role: "owner", createdAt: daysAgo(30) }],
    invitations: [],
  };
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class LocalRepository implements Repository {
  readonly mode = "demo" as const;
  private listeners = new Set<(user: SessionUser | null, event: string) => void>();
  private memory: DemoDatabase | null = null;

  private read(): DemoDatabase {
    if (this.memory) return this.memory;
    const raw = safeStorage.get(DB_KEY);
    try {
      const parsed = raw ? (JSON.parse(raw) as DemoDatabase) : null;
      this.memory = parsed?.version === 1 ? parsed : { version: 1, stores: [seedStore()] };
    } catch {
      this.memory = { version: 1, stores: [seedStore()] };
    }
    return this.memory;
  }

  private write() {
    if (this.memory) safeStorage.set(DB_KEY, JSON.stringify(this.memory));
  }

  private store(storeId: string) {
    const store = this.read().stores.find((candidate) => candidate.id === storeId);
    if (!store) throw new Error("Tienda no encontrada.");
    return store;
  }

  private emit(user: SessionUser | null, event: string) {
    this.listeners.forEach((listener) => listener(user, event));
  }

  /** Simula la latencia de la red para que los estados de carga se vean como en la nube. */
  private async tick() {
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  resetDemo() {
    this.memory = { version: 1, stores: [seedStore()] };
    this.write();
  }

  async getUser() {
    return safeStorage.get(SESSION_KEY) ? DEMO_USER : null;
  }

  onAuthChange(callback: (user: SessionUser | null, event: string) => void) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  async signIn() {
    await this.tick();
    safeStorage.set(SESSION_KEY, "1");
    this.emit(DEMO_USER, "SIGNED_IN");
  }

  async signUp() {
    await this.signIn();
    return { needsConfirmation: false };
  }

  async sendPasswordReset() {
    throw new Error("La recuperación de contraseña está disponible cuando la app usa la nube.");
  }

  async updatePassword() {
    throw new Error("El cambio de contraseña está disponible cuando la app usa la nube.");
  }

  async signOut() {
    safeStorage.remove(SESSION_KEY);
    this.emit(null, "SIGNED_OUT");
  }

  async listStores(): Promise<Store[]> {
    await this.tick();
    return this.read().stores.map((store) => ({ id: store.id, name: store.name, role: "owner" as Role }));
  }

  async createStore(name: string) {
    const trimmed = name.trim();
    if (trimmed.length < 2) throw new Error("Escribe el nombre de la tienda.");
    const db = this.read();
    if (db.stores.length >= 5) throw new Error("Puedes administrar máximo 5 tiendas.");
    const store: DemoStore = {
      id: uid(),
      name: trimmed,
      nextSku: 1,
      nextOrder: 1,
      products: [],
      movements: [],
      orders: [],
      suppliers: [],
      members: [{ userId: DEMO_USER.id, email: DEMO_USER.email, role: "owner", createdAt: now() }],
      invitations: [],
    };
    db.stores.push(store);
    this.write();
    return store.id;
  }

  async renameStore(storeId: string, name: string) {
    if (name.trim().length < 2) throw new Error("Escribe el nombre de la tienda.");
    this.store(storeId).name = name.trim();
    this.write();
  }

  async loadStore(storeId: string): Promise<StoreData> {
    await this.tick();
    const store = this.store(storeId);
    return clone({
      products: [...store.products].sort((a, b) => a.name.localeCompare(b.name, "es")),
      movements: [...store.movements].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      orders: [...store.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      suppliers: [...store.suppliers].sort((a, b) => a.name.localeCompare(b.name, "es")),
    });
  }

  async createProduct(storeId: string, input: ProductInput) {
    const store = this.store(storeId);
    const product: Product = {
      id: uid(),
      name: input.name.trim(),
      sku: `NS-${String(store.nextSku).padStart(3, "0")}`,
      category: input.category,
      unit: input.unit,
      stock: input.stock,
      minStock: input.minStock,
      cost: input.cost,
      price: input.price,
      supplierId: input.supplierId,
      active: true,
      updatedAt: now(),
    };
    store.nextSku += 1;
    store.products.push(product);
    if (product.stock > 0) {
      store.movements.unshift({
        id: uid(),
        productId: product.id,
        type: "in",
        delta: product.stock,
        stockAfter: product.stock,
        note: "Inventario inicial",
        orderId: null,
        createdByEmail: DEMO_USER.email,
        createdAt: now(),
      });
    }
    this.write();
    return clone(product);
  }

  async updateProduct(storeId: string, productId: string, input: Omit<ProductInput, "stock"> & { active?: boolean }) {
    const product = this.store(storeId).products.find((candidate) => candidate.id === productId);
    if (!product) throw new Error("Producto no encontrado.");
    Object.assign(product, {
      name: input.name.trim(),
      category: input.category,
      unit: input.unit,
      minStock: input.minStock,
      cost: input.cost,
      price: input.price,
      supplierId: input.supplierId,
      ...(input.active === undefined ? {} : { active: input.active }),
      updatedAt: now(),
    });
    this.write();
  }

  async registerMovement(storeId: string, productId: string, type: MovementType, quantity: number, note: string) {
    await this.tick();
    const store = this.store(storeId);
    const product = store.products.find((candidate) => candidate.id === productId);
    if (!product) throw new Error("Producto no encontrado.");
    const { delta, stockAfter } = applyMovement(product, type, quantity);
    product.stock = stockAfter;
    product.updatedAt = now();
    const movement: Movement = {
      id: uid(),
      productId,
      type,
      delta,
      stockAfter,
      note: note.trim().slice(0, 200),
      orderId: null,
      createdByEmail: DEMO_USER.email,
      createdAt: now(),
    };
    store.movements.unshift(movement);
    this.write();
    return clone(movement);
  }

  async createSupplier(storeId: string, input: SupplierInput) {
    const supplier: Supplier = { id: uid(), ...input, name: input.name.trim() };
    this.store(storeId).suppliers.push(supplier);
    this.write();
    return clone(supplier);
  }

  async updateSupplier(storeId: string, supplierId: string, input: SupplierInput) {
    const supplier = this.store(storeId).suppliers.find((candidate) => candidate.id === supplierId);
    if (!supplier) throw new Error("Proveedor no encontrado.");
    Object.assign(supplier, input);
    this.write();
  }

  async deleteSupplier(storeId: string, supplierId: string) {
    const store = this.store(storeId);
    store.suppliers = store.suppliers.filter((supplier) => supplier.id !== supplierId);
    store.products.forEach((product) => {
      if (product.supplierId === supplierId) product.supplierId = null;
    });
    store.orders.forEach((order) => {
      if (order.supplierId === supplierId) order.supplierId = null;
    });
    this.write();
  }

  private order(storeId: string, orderId: string) {
    const order = this.store(storeId).orders.find((candidate) => candidate.id === orderId);
    if (!order) throw new Error("Pedido no encontrado.");
    return order;
  }

  async createOrder(storeId: string, input: OrderInput) {
    const store = this.store(storeId);
    const order: Order = {
      id: uid(),
      code: `PED-${String(store.nextOrder).padStart(4, "0")}`,
      supplierId: input.supplierId,
      status: "draft",
      notes: input.notes,
      createdAt: now(),
      sentAt: null,
      receivedAt: null,
      items: input.items,
    };
    store.nextOrder += 1;
    store.orders.unshift(order);
    this.write();
    return clone(order);
  }

  async updateOrderDraft(storeId: string, orderId: string, input: OrderInput) {
    const order = this.order(storeId, orderId);
    if (order.status !== "draft") throw new Error("Solo se pueden editar pedidos en borrador.");
    Object.assign(order, input);
    this.write();
  }

  async deleteOrderDraft(storeId: string, orderId: string) {
    const store = this.store(storeId);
    if (this.order(storeId, orderId).status !== "draft") throw new Error("Solo se pueden borrar pedidos en borrador.");
    store.orders = store.orders.filter((order) => order.id !== orderId);
    this.write();
  }

  async sendOrder(storeId: string, orderId: string) {
    const order = this.order(storeId, orderId);
    if (order.status !== "draft") throw new Error("Solo un borrador se puede marcar como enviado.");
    order.status = "sent";
    order.sentAt = now();
    this.write();
  }

  async cancelOrder(storeId: string, orderId: string) {
    const order = this.order(storeId, orderId);
    if (order.status === "received" || order.status === "cancelled") throw new Error("El pedido ya está cerrado.");
    order.status = "cancelled";
    this.write();
  }

  async receiveOrder(storeId: string, orderId: string) {
    await this.tick();
    const store = this.store(storeId);
    const order = this.order(storeId, orderId);
    if (order.status !== "sent") throw new Error("Solo se puede recibir un pedido enviado.");
    for (const item of order.items) {
      const product = store.products.find((candidate) => candidate.id === item.productId);
      if (!product) continue;
      product.stock += item.quantity;
      if (item.unitCost > 0) product.cost = item.unitCost;
      product.updatedAt = now();
      store.movements.unshift({
        id: uid(),
        productId: product.id,
        type: "in",
        delta: item.quantity,
        stockAfter: product.stock,
        note: `Recepción de ${order.code}`,
        orderId: order.id,
        createdByEmail: DEMO_USER.email,
        createdAt: now(),
      });
    }
    order.status = "received";
    order.receivedAt = now();
    this.write();
  }

  async listMembers(storeId: string) {
    const store = this.store(storeId);
    return clone({ members: store.members, invitations: store.invitations });
  }

  async inviteMember(storeId: string, email: string, role: Role) {
    const store = this.store(storeId);
    const clean = email.trim().toLowerCase();
    if (store.invitations.some((invitation) => invitation.email === clean)) {
      throw new Error("Ya existe un registro con esos datos.");
    }
    store.invitations.push({ id: uid(), email: clean, role, createdAt: now() });
    this.write();
  }

  async cancelInvitation(storeId: string, invitationId: string) {
    const store = this.store(storeId);
    store.invitations = store.invitations.filter((invitation) => invitation.id !== invitationId);
    this.write();
  }

  async updateMemberRole() {
    throw new Error("En la demostración solo existe el propietario.");
  }

  async removeMember() {
    throw new Error("En la demostración solo existe el propietario.");
  }
}
