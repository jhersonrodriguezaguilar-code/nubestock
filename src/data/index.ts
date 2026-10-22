import { LocalRepository } from "./localRepository";
import type { Repository } from "./repository";
import { SupabaseRepository } from "./supabaseRepository";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Con las variables de Supabase la app usa la nube; sin ellas, el modo demostración. */
export const repository: Repository =
  url && anonKey ? new SupabaseRepository(url, anonKey) : new LocalRepository();

export const isDemo = repository.mode === "demo";
export { errorMessage } from "./repository";
export type { SessionUser } from "./repository";
