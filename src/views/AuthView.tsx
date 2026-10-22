import { useState } from "react";
import { CircleNotch, Storefront } from "@phosphor-icons/react";
import { errorMessage, isDemo, repository } from "../data";
import { useAuth } from "../state/AuthContext";

type Mode = "login" | "signup" | "reset";

const shelf = [
  { name: "Arroz 1 kg", stock: 24, min: 12 },
  { name: "Leche entera 1 L", stock: 4, min: 10 },
  { name: "Pan tajado", stock: 3, min: 8 },
  { name: "Café 250 g", stock: 15, min: 8 },
];

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-page">
      <section className="auth-story" aria-hidden="true">
        <div className="brand-lockup brand-lockup--light">
          <div className="brand-mark">
            <Storefront size={21} weight="fill" />
          </div>
          <div className="brand-name">
            Nube<span>Stock</span>
          </div>
        </div>
        <h2>Sabe qué hay en tu estantería aunque no estés en la tienda.</h2>
        <div className="auth-shelf">
          {shelf.map((item) => {
            const low = item.stock <= item.min;
            return (
              <div className="auth-shelf__row" key={item.name}>
                <span>{item.name}</span>
                <span className="auth-shelf__track">
                  <span className={low ? "low" : ""} style={{ width: `${Math.min(100, (item.stock / (item.min * 2)) * 100)}%` }} />
                </span>
                <strong>{item.stock}</strong>
              </div>
            );
          })}
        </div>
        <p>Inventario, ventas y pedidos a proveedores para tiendas de barrio.</p>
      </section>
      <main className="auth-panel">{children}</main>
    </div>
  );
}

export function AuthView() {
  const { recovering, finishRecovery } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setInfo("");
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return setError("Escribe un correo válido.");
    if (mode !== "reset" && password.length < (mode === "signup" ? 8 : 1)) {
      return setError(mode === "signup" ? "La contraseña debe tener al menos 8 caracteres." : "Escribe tu contraseña.");
    }
    setBusy(true);
    try {
      if (mode === "login") await repository.signIn(cleanEmail, password);
      if (mode === "signup") {
        const { needsConfirmation } = await repository.signUp(cleanEmail, password);
        if (needsConfirmation) {
          setInfo(`Te enviamos un enlace a ${cleanEmail}. Ábrelo para activar la cuenta y luego inicia sesión.`);
          setMode("login");
        }
      }
      if (mode === "reset") {
        await repository.sendPasswordReset(cleanEmail);
        setInfo(`Si ${cleanEmail} tiene cuenta, recibirás un enlace para crear una contraseña nueva.`);
        setMode("login");
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    setBusy(true);
    try {
      await repository.updatePassword(password);
      finishRecovery();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  if (recovering) {
    return (
      <AuthShell>
        <form className="auth-form" onSubmit={savePassword} noValidate>
          <h1>Crea una contraseña nueva</h1>
          <label className="form-field">
            <span>Contraseña nueva</span>
            <input type="password" autoComplete="new-password" autoFocus value={password} onChange={(event) => setPassword(event.target.value)} />
            <small>Mínimo 8 caracteres.</small>
          </label>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button button--primary button--block" type="submit" disabled={busy}>
            {busy ? <CircleNotch size={17} className="spin" /> : null} Guardar contraseña
          </button>
        </form>
      </AuthShell>
    );
  }

  if (isDemo) {
    return (
      <AuthShell>
        <div className="auth-form">
          <h1>Prueba NubeStock</h1>
          <p className="muted-text">
            Esta copia no está conectada a la nube todavía. Entra a una tienda de ejemplo; lo que cambies se guarda solo en este navegador.
          </p>
          <button
            className="button button--primary button--block"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await repository.signIn("", "");
            }}
          >
            {busy ? <CircleNotch size={17} className="spin" /> : null} Entrar a la tienda de ejemplo
          </button>
          <p className="auth-footnote">Para usar la nube, configura Supabase como indica el README.</p>
        </div>
      </AuthShell>
    );
  }

  const titles: Record<Mode, string> = {
    login: "Entra a tu tienda",
    signup: "Crea tu cuenta",
    reset: "Recupera tu contraseña",
  };

  return (
    <AuthShell>
      <form className="auth-form" onSubmit={submit} noValidate>
        <h1>{titles[mode]}</h1>
        {mode === "signup" ? <p className="muted-text">Si te invitaron a una tienda, usa el mismo correo de la invitación.</p> : null}
        <label className="form-field">
          <span>Correo</span>
          <input type="email" autoComplete="email" autoFocus value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {mode !== "reset" ? (
          <label className="form-field">
            <span>Contraseña</span>
            <input
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {mode === "signup" ? <small>Mínimo 8 caracteres.</small> : null}
          </label>
        ) : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        {info ? <p className="form-info" role="status">{info}</p> : null}
        <button className="button button--primary button--block" type="submit" disabled={busy}>
          {busy ? <CircleNotch size={17} className="spin" /> : null}
          {mode === "login" ? "Entrar" : mode === "signup" ? "Crear cuenta" : "Enviar enlace"}
        </button>
        <div className="auth-links">
          {mode !== "login" ? (
            <button className="text-button" type="button" onClick={() => setMode("login")}>
              Ya tengo cuenta
            </button>
          ) : (
            <>
              <button className="text-button" type="button" onClick={() => setMode("signup")}>
                Crear cuenta
              </button>
              <button className="text-button" type="button" onClick={() => setMode("reset")}>
                Olvidé mi contraseña
              </button>
            </>
          )}
        </div>
      </form>
    </AuthShell>
  );
}
