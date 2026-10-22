import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { repository, type SessionUser } from "../data";

type AuthState = {
  user: SessionUser | null;
  loading: boolean;
  /** El usuario llegó desde el correo de recuperación y debe crear una contraseña nueva. */
  recovering: boolean;
  finishRecovery: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let active = true;
    repository
      .getUser()
      .then((current) => {
        if (active) setUser(current);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const unsubscribe = repository.onAuthChange((next, event) => {
      setUser(next);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, recovering, finishRecovery: () => setRecovering(false) }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
};
