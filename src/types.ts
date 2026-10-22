export type Role = "owner" | "employee";
export type MovementType = "in" | "out" | "adjust";
export type ProductStatus = "healthy" | "low" | "critical";
export type OrderStatus = "draft" | "sent" | "received" | "cancelled";

export type Store = {
  id: string;
  name: string;
  role: Role;
};

export type Member = {
  userId: string;
  email: string;
  role: Role;
  createdAt: string;
};

export type Invitation = {
  id: string;
  email: string;
  role: Role;
  createdAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
};

export type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  stock: number;
  minStock: number;
  cost: number;
  price: number;
  supplierId: string | null;
  active: boolean;
  updatedAt: string;
};

export type Movement = {
  id: string;
  productId: string;
  type: MovementType;
  delta: number;
  stockAfter: number;
  note: string;
  orderId: string | null;
  createdByEmail: string;
  createdAt: string;
};

export type OrderItem = {
  productId: string;
  quantity: number;
  unitCost: number;
};

export type Order = {
  id: string;
  code: string;
  supplierId: string | null;
  status: OrderStatus;
  notes: string;
  createdAt: string;
  sentAt: string | null;
  receivedAt: string | null;
  items: OrderItem[];
};

export type ProductInput = {
  name: string;
  category: string;
  unit: string;
  stock: number;
  minStock: number;
  cost: number;
  price: number;
  supplierId: string | null;
};

export type SupplierInput = Omit<Supplier, "id">;

export type OrderInput = {
  supplierId: string | null;
  notes: string;
  items: OrderItem[];
};

export type StoreData = {
  products: Product[];
  movements: Movement[];
  orders: Order[];
  suppliers: Supplier[];
};
