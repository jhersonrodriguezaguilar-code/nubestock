import { useCallback, useEffect, useState } from "react";
import { EnvelopeSimple, Trash, UserPlus, UsersThree } from "@phosphor-icons/react";
import { PageHeader, Spinner } from "../components/ui";
import { errorMessage, isDemo, repository } from "../data";
import { formatDate, initials } from "../lib/format";
import { useAuth } from "../state/AuthContext";
import { useStore } from "../state/StoreContext";
import type { Invitation, Member, Role } from "../types";

const roleLabel: Record<Role, string> = { owner: "Propietario", employee: "Empleado" };

export function TeamView() {
  const { user } = useAuth();
  const { store, isOwner, run, reloadStores } = useStore();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("employee");

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    try {
      const result = await repository.listMembers(store.id);
      setMembers(result.members);
      setInvitations(result.invitations);
      setError("");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void load();
  }, [load]);

  const invite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return setError("Escribe un correo válido.");
    if (members.some((member) => member.email === clean)) return setError("Esa persona ya es parte del equipo.");
    setError("");
    const ok = await run(() => repository.inviteMember(store!.id, clean, role), `Invitación guardada para ${clean}.`, { reload: false });
    if (ok) {
      setEmail("");
      void load();
    }
  };

  const changeRole = async (member: Member, next: Role) => {
    const ok = await run(() => repository.updateMemberRole(store!.id, member.userId, next), `${member.email} ahora es ${roleLabel[next].toLowerCase()}.`, { reload: false });
    if (ok) void load();
  };

  const remove = async (member: Member) => {
    const self = member.userId === user?.id;
    if (!window.confirm(self ? `¿Salir de ${store?.name}? Perderás el acceso a esta tienda.` : `¿Quitar a ${member.email} de la tienda?`)) return;
    const ok = await run(() => repository.removeMember(store!.id, member.userId), self ? "Saliste de la tienda." : `${member.email} ya no tiene acceso.`, { reload: false });
    if (ok) {
      if (self) await reloadStores();
      else void load();
    }
  };

  return (
    <div className="view-stack">
      <PageHeader
        eyebrow="Accesos de la tienda"
        title="Equipo"
        description="El propietario gestiona productos, pedidos, proveedores y reportes. El empleado registra ventas, compras y conteos, y recibe pedidos."
      />

      {isOwner ? (
        <section className="panel" aria-labelledby="invite-title">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Agregar a alguien</span>
              <h2 id="invite-title">Invitar por correo</h2>
            </div>
          </div>
          <p className="muted-text">
            {isDemo
              ? "En la demostración la invitación queda guardada, pero nadie más puede entrar porque los datos viven en este navegador."
              : "La persona crea su cuenta en NubeStock con este correo y la tienda le aparece al entrar. No enviamos el correo por ti: avísale por WhatsApp."}
          </p>
          <form className="invite-form" onSubmit={invite} noValidate>
            <label className="form-field">
              <span>Correo</span>
              <input type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="empleado@correo.com" />
            </label>
            <label className="form-field">
              <span>Rol</span>
              <select value={role} onChange={(event) => setRole(event.target.value as Role)}>
                <option value="employee">Empleado</option>
                <option value="owner">Propietario</option>
              </select>
            </label>
            <button className="button button--primary" type="submit">
              <UserPlus size={17} /> Invitar
            </button>
          </form>
        </section>
      ) : null}

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="panel" aria-labelledby="members-title">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">Con acceso</span>
            <h2 id="members-title">Personas en {store?.name}</h2>
          </div>
        </div>
        {loading ? (
          <Spinner label="Cargando equipo" />
        ) : (
          <ul className="member-list">
            {members.map((member) => {
              const self = member.userId === user?.id;
              return (
                <li key={member.userId} className="member-row">
                  <span className="avatar avatar--green" aria-hidden="true">
                    {initials(member.email)}
                  </span>
                  <span className="member-copy">
                    <strong>
                      {member.email} {self ? <small>(tú)</small> : null}
                    </strong>
                    <small>Desde el {formatDate(member.createdAt)}</small>
                  </span>
                  {isOwner && !self ? (
                    <select aria-label={`Rol de ${member.email}`} value={member.role} onChange={(event) => changeRole(member, event.target.value as Role)}>
                      <option value="employee">Empleado</option>
                      <option value="owner">Propietario</option>
                    </select>
                  ) : (
                    <span className="role-pill">{roleLabel[member.role]}</span>
                  )}
                  {(isOwner && !self) || (self && !isDemo) ? (
                    <button className="icon-button icon-button--subtle" type="button" aria-label={self ? "Salir de la tienda" : `Quitar a ${member.email}`} title={self ? "Salir de la tienda" : "Quitar acceso"} onClick={() => remove(member)}>
                      <Trash size={17} />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isOwner && invitations.length ? (
        <section className="panel" aria-labelledby="pending-title">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">Aún no entran</span>
              <h2 id="pending-title">Invitaciones pendientes</h2>
            </div>
          </div>
          <ul className="member-list">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="member-row">
                <span className="avatar" aria-hidden="true">
                  <EnvelopeSimple size={16} />
                </span>
                <span className="member-copy">
                  <strong>{invitation.email}</strong>
                  <small>
                    {roleLabel[invitation.role]}, invitado el {formatDate(invitation.createdAt)}
                  </small>
                </span>
                <button
                  className="icon-button icon-button--subtle"
                  type="button"
                  aria-label={`Cancelar invitación de ${invitation.email}`}
                  title="Cancelar invitación"
                  onClick={async () => {
                    const ok = await run(() => repository.cancelInvitation(store!.id, invitation.id), "Invitación cancelada.", { reload: false });
                    if (ok) void load();
                  }}
                >
                  <Trash size={17} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!isOwner ? (
        <p className="muted-text">
          <UsersThree size={16} /> Solo el propietario puede invitar personas o cambiar roles.
        </p>
      ) : null}
    </div>
  );
}
