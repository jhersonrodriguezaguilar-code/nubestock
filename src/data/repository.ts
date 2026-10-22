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

export type SessionUser = { id: string; email: string };

/** Contrato único de datos: lo implementan Supabase (nube) y el modo demostración (navegador). */
export interface Repository {
  readonly mode: "cloud" | "demo";

  getUser(): Promise<SessionUser | null>;
  onAuthChange(callback: (user: SessionUser | null, event: string) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  signOut(): Promise<void>;

  listStores(): Promise<Store[]>;
  createStore(name: string): Promise<string>;
  renameStore(storeId: string, name: string): Promise<void>;

  loadStore(storeId: string): Promise<StoreData>;

  createProduct(storeId: string, input: ProductInput): Promise<Product>;
  updateProduct(storeId: string, productId: string, input: Omit<ProductInput, "stock"> & { active?: boolean }): Promise<void>;
  registerMovement(storeId: string, productId: string, type: MovementType, quantity: number, note: string): Promise<Movement>;

  createSupplier(storeId: string, input: SupplierInput): Promise<Supplier>;
  updateSupplier(storeId: string, supplierId: string, input: SupplierInput): Promise<void>;
  deleteSupplier(storeId: string, supplierId: string): Promise<void>;

  createOrder(storeId: string, input: OrderInput): Promise<Order>;
  updateOrderDraft(storeId: string, orderId: string, input: OrderInput): Promise<void>;
  deleteOrderDraft(storeId: string, orderId: string): Promise<void>;
  sendOrder(storeId: string, orderId: string): Promise<void>;
  cancelOrder(storeId: string, orderId: string): Promise<void>;
  receiveOrder(storeId: string, orderId: string): Promise<void>;

  listMembers(storeId: string): Promise<{ members: Member[]; invitations: Invitation[] }>;
  inviteMember(storeId: string, email: string, role: Role): Promise<void>;
  cancelInvitation(storeId: string, invitationId: string): Promise<void>;
  updateMemberRole(storeId: string, userId: string, role: Role): Promise<void>;
  removeMember(storeId: string, userId: string): Promise<void>;
}

/** Mensaje claro para el usuario a partir de un error de la red o de la base de datos. */
export const errorMessage = (error: unknown): string => {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return "Sin conexión a internet. Revisa la red e inténtalo de nuevo.";
  }
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  if (/Invalid login credentials/i.test(raw)) return "Correo o contraseña incorrectos.";
  if (/Email not confirmed/i.test(raw)) return "Confirma tu correo con el enlace que te enviamos antes de entrar.";
  if (/User already registered/i.test(raw)) return "Ya existe una cuenta con ese correo. Inicia sesión.";
  if (/Password should be at least/i.test(raw)) return "La contraseña debe tener al menos 8 caracteres.";
  if (/rate limit/i.test(raw)) return "Demasiados intentos. Espera un minuto y vuelve a intentarlo.";
  if (/Failed to fetch|NetworkError/i.test(raw)) return "No se pudo conectar con la nube. Inténtalo de nuevo.";
  if (/row-level security|permission denied/i.test(raw)) return "Tu rol no tiene permiso para esta acción.";
  if (/duplicate key/i.test(raw)) return "Ya existe un registro con esos datos.";
  return raw || "Ocurrió un error inesperado.";
};
