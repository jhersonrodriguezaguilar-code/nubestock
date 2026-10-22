import { ArrowRight, Browser, Database, GithubLogo, LockKey, ShieldCheck } from "@phosphor-icons/react";
import { PageHeader } from "../components/ui";
import { isDemo } from "../data";

const decisions = [
  ["Modelo de servicio", "PaaS", "Supabase administra servidores, base de datos PostgreSQL, autenticación y copias; el equipo solo escribe la aplicación y las reglas de datos."],
  ["Modelo de despliegue", "Nube pública", "La web se publica en GitHub Pages y los datos viven en Supabase. Se entra desde cualquier celular o computador con internet."],
  ["Multinube", "No en esta etapa", "Un solo proveedor de datos reduce costos y complejidad. El código separa la capa de datos para poder cambiar de proveedor después."],
];

const traits = [
  ["Autoservicio bajo demanda", "El propietario crea su cuenta y su tienda sin pedir nada a nadie."],
  ["Acceso amplio a la red", "Funciona en el navegador del celular, la tableta o el computador, y se puede instalar como app."],
  ["Agrupación de recursos", "Varias tiendas comparten la misma plataforma; las reglas RLS de la base de datos separan los datos de cada una."],
  ["Elasticidad", "Supabase y GitHub Pages escalan sin cambiar el código si llegan más tiendas o usuarios."],
  ["Servicio medido", "Se paga según uso. El plan gratuito de ambos servicios cubre una tienda piloto."],
];

const risks = [
  ["Conexión inestable", "Aviso de “sin conexión”, la app se abre sin internet (PWA) y no deja guardar cambios a medias."],
  ["Accesos no autorizados", "Inicio de sesión con correo y contraseña, roles de propietario y empleado, y reglas RLS en cada tabla."],
  ["Errores en el inventario", "Las existencias solo cambian con movimientos; el historial no se puede editar y no se permiten negativos."],
  ["Pérdida de datos", "Copias automáticas de Supabase y respaldo JSON descargable desde Configuración."],
  ["Dependencia del proveedor", "PostgreSQL estándar y migración SQL en el repositorio; los datos se exportan en CSV o JSON."],
  ["Pagos y datos sensibles", "Fuera del alcance: la app no maneja pagos ni tarjetas."],
];

export function CloudView() {
  return (
    <div className="view-stack">
      <PageHeader
        eyebrow="Propuesta de Cloud Computing"
        title="Cómo funciona NubeStock en la nube"
        description="Las decisiones de la propuesta inicial convertidas en una aplicación que funciona."
      />

      <section className="panel" aria-labelledby="arch-title">
        <h2 id="arch-title" className="section-title">
          Arquitectura
        </h2>
        <div className="arch-flow">
          <div className="arch-node">
            <Browser size={26} />
            <strong>Navegador o PWA</strong>
            <span>React y TypeScript. Celular, tableta o computador.</span>
          </div>
          <ArrowRight className="arch-arrow" size={22} aria-hidden="true" />
          <div className="arch-node">
            <GithubLogo size={26} />
            <strong>GitHub Pages</strong>
            <span>Hosting estático con HTTPS. Publicación automática con GitHub Actions.</span>
          </div>
          <ArrowRight className="arch-arrow" size={22} aria-hidden="true" />
          <div className="arch-node arch-node--accent">
            <Database size={26} />
            <strong>Supabase (PaaS)</strong>
            <span>Auth, PostgreSQL con RLS y funciones para ventas, compras y pedidos.</span>
          </div>
        </div>
        <p className="muted-text arch-note">
          {isDemo
            ? "Ahora mismo la app corre en modo demostración: los datos se guardan en este navegador. Al configurar Supabase usa la nube sin cambiar las pantallas."
            : "Conectada a Supabase: los datos se guardan en la nube y se ven desde cualquier dispositivo del equipo."}
        </p>
      </section>

      <section className="panel" aria-labelledby="decisions-title">
        <h2 id="decisions-title" className="section-title">
          Decisiones de la propuesta
        </h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Decisión</th>
                <th scope="col">Elección</th>
                <th scope="col">Cómo se aplica</th>
              </tr>
            </thead>
            <tbody>
              {decisions.map(([decision, choice, how]) => (
                <tr key={decision}>
                  <td>
                    <strong>{decision}</strong>
                  </td>
                  <td>{choice}</td>
                  <td className="wrap-cell">{how}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="report-grid">
        <section className="panel" aria-labelledby="traits-title">
          <h2 id="traits-title" className="section-title">
            <ShieldCheck size={19} /> Características de la nube
          </h2>
          <dl className="definition-list">
            {traits.map(([term, detail]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="panel" aria-labelledby="risks-title">
          <h2 id="risks-title" className="section-title">
            <LockKey size={19} /> Riesgos y cómo se atienden
          </h2>
          <dl className="definition-list">
            {risks.map(([term, detail]) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{detail}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
