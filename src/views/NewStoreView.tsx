import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleNotch, SignOut, Storefront } from "@phosphor-icons/react";
import { errorMessage, repository } from "../data";
import { useAuth } from "../state/AuthContext";
import { useStore } from "../state/StoreContext";

/** Primera tienda (sin menú) o una tienda adicional (dentro del menú). */
export function NewStoreView({ first = false }: { first?: boolean }) {
  const { user } = useAuth();
  const { reloadStores, notify } = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length < 2) return setError("Escribe el nombre de la tienda.");
    setBusy(true);
    try {
      const id = await repository.createStore(name.trim());
      await reloadStores(id);
      notify(`${name.trim()} está lista. Empieza agregando productos.`);
      navigate("/");
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  };

  const form = (
    <form className="auth-form" onSubmit={submit} noValidate>
      <span className="new-store-icon" aria-hidden="true">
        <Storefront size={26} weight="fill" />
      </span>
      <h1>{first ? "Crea tu tienda" : "Crea otra tienda"}</h1>
      <p className="muted-text">
        {first
          ? `Entraste como ${user?.email}. Si un propietario te invitó, pídele que use este mismo correo y vuelve a entrar.`
          : "Cada tienda tiene su propio inventario, proveedores y equipo."}
      </p>
      <label className="form-field">
        <span>Nombre de la tienda</span>
        <input autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej. Tienda La Esquina" />
      </label>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <button className="button button--primary button--block" type="submit" disabled={busy}>
        {busy ? <CircleNotch size={17} className="spin" /> : null} Crear tienda
      </button>
      {first ? (
        <button className="text-button" type="button" onClick={() => void repository.signOut()}>
          <SignOut size={15} /> Cerrar sesión
        </button>
      ) : (
        <button className="text-button" type="button" onClick={() => navigate(-1)}>
          Volver
        </button>
      )}
    </form>
  );

  return first ? <div className="center-page">{form}</div> : <div className="view-stack view-stack--narrow">{form}</div>;
}
