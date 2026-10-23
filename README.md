# NubeStock

Sistema de inventario y pedidos para tiendas de barrio. Proyecto de Cloud Computing (CUN) que convierte la propuesta *NubeStock: Propuesta inicial de proyecto* en una aplicación web funcional: **PaaS (Supabase) + nube pública (GitHub Pages)**, sin multinube en esta etapa.

## Qué hace

- **Cuentas y tiendas:** registro con correo, recuperación de contraseña, varias tiendas por cuenta y selector de tienda.
- **Roles:** el *propietario* gestiona productos, proveedores, pedidos, equipo y reportes; el *empleado* registra ventas, compras y conteos, y recibe pedidos. Las reglas se aplican en la base de datos (RLS), no solo en la pantalla.
- **Inventario:** productos con SKU automático, costo, precio, nivel mínimo y proveedor; búsqueda, filtros, archivado y exportación/importación CSV.
- **Movimientos:** venta, compra y ajuste por conteo físico. Las existencias solo cambian con movimientos, nunca quedan negativas y el historial no se edita.
- **Alertas de reposición:** cola en el resumen, contador en el menú y pedido sugerido por proveedor.
- **Pedidos:** varios productos por pedido, borrador → enviado → recibido (o cancelado). Al recibir se suman existencias y se actualiza el costo. Texto listo para WhatsApp o copiar.
- **Reportes:** ventas y ganancia estimadas, entradas/salidas por día (7 o 30 días), más vendidos, valor por categoría y productos sin rotación. Descarga en CSV.
- **Respaldo:** descarga JSON de todos los datos de la tienda.
- **PWA:** se instala en el celular, abre sin conexión y avisa cuando no hay internet.
- **Modo claro/oscuro**, diseño responsive y accesible (teclado, lectores de pantalla).
- **Página “Cómo funciona en la nube”** con la arquitectura y las decisiones de la propuesta.

Sin las variables de Supabase la app arranca en **modo demostración** (tienda de ejemplo guardada en el navegador).

## Ejecutar en el computador

Requiere Node.js 20 o superior.

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`.

## Conectar la nube (Supabase)

1. Crea un proyecto **nuevo** en [supabase.com](https://supabase.com) (plan gratuito).
2. En *SQL Editor* pega y ejecuta `supabase/migrations/001_init.sql` (una sola vez).
3. En *Authentication → Sign In / Providers → Email* deja activa **Confirm email** (evita que alguien tome una invitación con un correo ajeno).
4. En *Authentication → URL Configuration* pon como *Site URL* la dirección publicada (por ejemplo `https://TU-USUARIO.github.io/nubestock/`) y agrégala también en *Redirect URLs* junto con `http://localhost:5173/`.
5. Copia `.env.example` como `.env.local` y llena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (*Project Settings → API*). La anon key es pública; **nunca** uses la `service_role`.

## Publicar en GitHub Pages

1. Crea un repositorio llamado `nubestock` y sube este proyecto a la rama `main`.
2. En *Settings → Secrets and variables → Actions* crea los secretos `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. En *Settings → Pages* elige **GitHub Actions** como fuente.
4. Copia `docs/deploy-workflow.yml` a `.github/workflows/deploy.yml` (requiere permiso `workflow` en GitHub). Cada push a `main` ejecuta lint, pruebas y build, y publica en `https://TU-USUARIO.github.io/nubestock/` (`.github/workflows/deploy.yml`).

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compila TypeScript y genera `dist/` |
| `npm run lint` | ESLint |
| `npm test` | Pruebas de la lógica de inventario (Vitest) |
| `npm run test:db` | Ejecuta la migración en un Postgres embebido (PGlite) y prueba RLS, roles, movimientos y pedidos |

## Estructura

```
src/
  domain/inventory.ts      reglas de negocio puras (estados, movimientos, CSV, reportes) + pruebas
  data/                    contrato Repository con dos implementaciones: Supabase (nube) y local (demo)
  state/                   sesión, tienda actual y ventanas compartidas
  components/              estructura, formularios y piezas de interfaz
  views/                   pantallas
supabase/
  migrations/001_init.sql  tablas, disparadores, funciones RPC y políticas RLS
  tests/                   pruebas de la migración
```

## Límites conocidos

- No incluye pagos electrónicos ni datos de tarjetas (fuera del alcance de la propuesta).
- Sin conexión se puede abrir y consultar lo ya cargado, pero no se guardan cambios.
- Las invitaciones no envían correo: el propietario avisa a la persona, que se registra con ese correo.
- Se cargan los últimos 1.000 movimientos por tienda para pantallas y reportes.
