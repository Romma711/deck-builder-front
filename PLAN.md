# Plan de Desarrollo — Deck Builder Front

Página web constructor de mazos de TCG (Magic: The Gathering primero, multi-TCG a futuro),
con sistema de usuarios, dashboard, buscador público, validación de formatos y organizaciones.

- **Frontend**: Astro 7 + React + Tailwind CSS v4 (este repositorio)
- **Backend**: API Go existente en otro repositorio — **especificación: `openapi.yaml` (v3)**, en la raíz de este repo como referencia
- **Datos de cartas**: catálogo propio del backend (`/api/v3/cards`) como fuente de verdad; Scryfall solo como ayuda de autocompletado en el editor
- **Fase futura (SaaS para tiendas)**: detallado al final como roadmap — las **organizaciones** del backend son su cimiento

---

## Decisiones clave derivadas del backend (v3)

Estas son las particularidades de la API Go que condicionan el frontend:

| Tema | Realidad del backend | Decisión en el front |
|---|---|---|
| Auth | **Bearer JWT**: access corto + refresh rotatorio (`/auth/refresh`, reuso revoca la familia). No hay cookies | Interceptor con refresh automático; access en memoria, refresh en localStorage |
| Errores | Todos: `{"error": {"code", "message", "details?"}}` con codes enum | Manejador centralizado que traduce `code`/`details` a mensajes de UI |
| Cartas | Catálogo propio con UUID y `attributes` validados por GameSpec; los mazos guardan `CardInput` completo, no referencias | El back es la verdad. Scryfall solo sugiere datos para rellenar `CardInput` |
| Formatos | Vienen en `/games` (`deck_size`, `min_size`, `max_size`, `requires_leader`). **No hay banlist expuesta** | Validación en vivo = tamaño + leader + copias; si algún día hay banlist en el back, se consume |
| Mazos | `leader`/`partner` (para juegos que los requieren), `private` booleano, `deck_size` obligatorio, pueden ser personales u **de org** | Editor con soporte de leader/partner según `requires_leader` del formato |
| Duplicar | **No existe endpoint** | Duplicar = GET + POST desde el cliente |
| Buscador | `/decks` con filtros (game, format, owner, org, leader) + RLS de visibilidad. **Sin texto libre** | Buscador basado en filtros + paginación; texto libre queda como mejora futura |
| Catálogo | `/cards` con filtros game + q (ILIKE) + paginación | Búsqueda de cartas en el editor contra el back; Scryfall como fallback/sugerencia |

---

## Fase 0 — Cimientos

Objetivo: que cualquier pantalla siguiente se pueda construir sin rehacer nada.

1. **Integraciones de Astro**
   - `@tailwindcss/vite` (Tailwind v4) y `@astrojs/react` en `astro.config.mjs`.
2. **Estructura de carpetas**
   ```
   src/
     lib/
       api/          # cliente fetch + módulos: auth, decks, games, cards, orgs, search
       scryfall/     # cliente Scryfall (solo autocompletado/sugerencias)
       session/      # store de sesión: access en memoria, refresh en localStorage
     types/          # tipos generados del openapi.yaml: Game, Format, Deck, Card, User, Org...
     components/
       ui/           # botones, inputs, diálogos genéricos
       deck/         # editor, lista de cartas, validador visual
       search/       # buscador público de mazos (filtros)
       dashboard/    # tarjetas de mazos, filtros
       org/          # tarjetas de orgs, gestión de miembros
     layouts/  pages/  middleware/  styles/
   ```
3. **Tipos de dominio multi-TCG** espejando el backend
   - Tipos alineados 1:1 con los schemas del OpenAPI (`Game`, `Format`, `Card`, `CardInput`, `Deck`, `DeckInput`, `Organization`, `Member`, `Role`, `Error`, `TokenPair`...). Opción recomendada a futuro: generarlos con `openapi-typescript` desde `openapi.yaml` para que no se desincronicen cuando toques el backend.
   - `Deck`/`DeckInput` ya son multi-TCG por diseño del back (`game`/`format` como strings + GameSpec): no hace falta abstracción extra en el front.
4. **Cliente API tipado** (`src/lib/api/`)
   - `fetchBase` con `credentials` irrelevantes: envía `Authorization: Bearer <access>`, maneja 401 → intenta `/auth/refresh` una vez → si falla, logout y redirect a `/login`.
   - Parsea el envelope de error `{"error": {code, message, details}}` y lo expone tipado.
   - Módulos por dominio: `auth.ts` (register, login, refresh, logout, me, updateMe, deleteMe), `decks.ts`, `games.ts`, `cards.ts`, `orgs.ts`.
   - *Cuando modifiques endpoints en el repo Go, solo tocas esta capa (ideal: regenerar desde el OpenAPI).*
5. **Store de sesión** (`src/lib/session/`)
   - Access token **en memoria** (no persistido), refresh token en `localStorage` con rotación: al recibir 401 se llama `/auth/refresh`, se guardan los tokens nuevos y se reintenta la petición original una sola vez.
   - Si el backend detecta reuso de refresh (revoca la familia): limpiar sesión y mandar a `/login`.
   - En Astro: el middleware protege rutas (`/dashboard`, `/decks/*`, `/orgs/*`, `/settings`) pero la validación real de token es client-side (el JWT no es legible en el servidor sin parsearlo — se verifica existencia de sesión en localStorage/`sessionStorage` y se redirige).
6. **Capa Scryfall (rol acotado)** (`src/lib/scryfall/`)
   - Solo para **ayudar a rellenar `CardInput`** cuando el usuario crea una carta que no está en el catálogo del back (búsqueda `/cards/named` o `/cards/search`, devolviendo nombre, set, número, imagen y datos convertidos a `attributes`).
   - Rate limit (10 req/s) y caché en memoria/localStorage.
   - Nunca es la fuente al guardar: el back valida siempre con su GameSpec.

## Fase 1 — Sistema de usuarios

7. **Pantallas**: `/register`, `/login`, `/settings` (editar username/email con `PUT /me`, eliminar cuenta con `DELETE /me`, logout).
8. **Estados de sesión**: loading, error de credenciales (401 de login), sesión expirada (refresh fallido → redirect), rate limit (429 con `Retry-After`).
9. **Componentes**: formularios validados en cliente (username ≥3, email, password 8–72), feedback de `details` por campo del backend, guard de rutas.
10. **Dashboard base**: `/dashboard` con tarjetas de mazos propios (`GET /decks?owner=<mi uuid>`), mostrando nombre, formato, líder si existe, `private` (con candado), fechas.

## Fase 2 — Catálogo y selector de juegos

11. **Pantalla** `/games` y datos cacheados de `GET /games` (juegos activos con formatos y reglas).
12. **Hook/store de catálogo**: juegos y formatos se cargan una vez y viven en contexto (el editor, el buscador y el dashboard los consumen).
13. Selector juego → formato en todo el sitio, respetando `deck_size`, `min_size`, `max_size` y `requires_leader` de cada formato.

## Fase 3 — Editor de mazos (corazón del producto)

14. **Pantalla** `/decks/new` y `/decks/:id/edit`.
15. **Estilo de editor: búsqueda + lista cantidad/nombre** (decidido, sin drag & drop en v1)
    - Buscador de cartas contra `GET /api/v3/cards?game=&q=` (catálogo del back, ILIKE por nombre).
    - Si el back no encuentra la carta y el juego es MTG: sugerencia desde Scryfall para **crear la carta** (rellena `CardInput`: nombre, serial_set, image, attributes) — siempre pasando por el guardado del back.
    - Añadir con cantidad (1–99); secciones: **leader/partner** (si `requires_leader`) y **cartas principales**.
    - Quitar, cambiar cantidad, buscar dentro del mazo.
16. **Validación en vivo en frontend** (feedback inmediato, sin guardar)
    - Tamaño total vs `deck_size`/`min_size`/`max_size` del formato.
    - Leader obligatorio cuando `requires_leader` es true.
    - Copias máximas por carta (regla configurable en el front, ya que el back no la expone).
    - Botón **Guardar deshabilitado** mientras haya errores duros.
17. **Guardado contra el backend Go** — el back es la **autoridad** (GameSpec): aunque alguien se salte el frontend, la API rechaza el mazo inválido. El frontend traduce `VALIDATION_ERROR` + `details` a mensajes claros junto a la carta/sección afectada.
18. **Operaciones CRUD**: crear (`POST /decks`), editar (`PUT /decks/{id}`, reemplazo completo), borrar (`DELETE`), **duplicar** (GET + POST desde el cliente), cambiar `private`.
19. **Detalle** `/decks/:id`: vista de solo lectura con lista de cartas, leader/partner, metadatos.

## Fase 4 — Buscador público de mazos

20. **Pantalla** `/search`: **filtros contra `GET /decks`** — juego, formato, owner (username), org, leader — más paginación con `ListMeta.total`. Sin texto libre por ahora (el back no lo expone).
21. **Visibilidad**: sin token solo mazos públicos; con token además los privados propios y los de las orgs del usuario (RLS del back) — el frontend no filtra, solo muestra lo que el back devuelve.
22. **Detalle público** `/decks/:id` con botón **"Copiar a mi dashboard"** (GET + POST) si el usuario está logueado.
23. Enlazar buscador desde home y dashboard.

## Fase 5 — Organizaciones

24. **Pantalla** `/orgs`: listar orgs del usuario (`GET /orgs` con su rol), crear org (`POST /orgs`).
25. **Detalle de org** `/orgs/:id`: información, miembros (`GET /members`), y gestión según rol:
   - Admin+: agregar miembro por username (`POST /members`).
   - Owner: cambiar rol (`PATCH`), eliminar org (`DELETE`).
   - Cualquiera: auto-salirse (`DELETE /members/{userId}`).
   - Respetar los bloqueos del back (último owner, rol superior al propio) mostrando sus errores.
26. **Mazos de org**: en el editor, opción de asignar el mazo a una org de la que seas miembro (`org_id`); en el dashboard, sección "Mazos de mis orgs".
27. UI de roles: el rol determina qué acciones se muestran (member/admin/owner), pero el back manda.

## Fase 6 — Pulido y calidad

28. Estados vacíos y de carga consistentes; diseño responsive (móvil primero en editor y buscador).
29. Manejo global de `429 RateLimited` (mostrar `Retry-After`) y `5xx` con retry simple.
30. Lighthouse/SEO en páginas públicas (home, buscador, detalle de mazo).
31. Type-check estricto (`astro check`), lint, tipos generados desde `openapi.yaml` en CI.

---

# Roadmap futuro — Fase SaaS para tiendas (párrafo 3)

> No se implementa ahora. Las decisiones de las fases 0–6 están tomadas para **habilitarlo sin reescrituras**.

**Qué habilita ya el plan actual:**
- **Organizaciones con roles** (Fase 5): una tienda = una org. Ya existe en el backend.
- `Deck` con `org_id` y formato normalizado (`{ game, format, cards: [{ card, quantity }] }`) → formato de **export de mazo** reutilizable tal cual.
- Cliente API tipado aislado → añadir endpoints de tiendas no toca la UI existente.
- Catálogo de cartas con UUIDs estables en el back → matching de inventario por el mismo `card.id`.

**Fases futuras:**

1. **API pública de tiendas** (en backend Go)
   - Auth de tiendas (API keys / OAuth), documentación OpenAPI.
   - Endpoint de import: `POST /orgs/{id}/decks` recibiendo el mazo exportado.
2. **Matching de inventario**
   - El backend cruza las cartas del mazo con el inventario de la tienda (por `card.id` + versión/condición).
   - Respuesta por carta: `available | unavailable | partial`.
3. **Checklist de compra**
   - Vista en la web de la tienda con checks por carta comprada.
   - Estados persistentes: pendiente → en carrito → comprado.
4. **Multi-tenant y billing**
   - Planes por org (free/pro), límites de mazos importados, dominio propio opcional.
5. **Compatibilidad**
   - Webhooks/notificaciones al deck builder original ("mazo comprado").
   - Export en formatos estándar (MTGO `.txt`, Moxfield/Archidekt) para ampliar alcance.
   - Búsqueda de mazos por texto libre (`q` en `/decks`) cuando el backend la agregue.

---

## Resumen de decisiones tomadas

| Decisión | Elección |
|---|---|
| Backend | API Go existente (openapi.yaml v3 en la raíz de este repo) |
| Sesión | JWT: access en memoria + refresh en localStorage con interceptor de rotación |
| Fuente de cartas | Catálogo del backend como verdad; Scryfall solo como ayuda de autocompletado |
| Validación de formatos | Backend Go como autoridad (GameSpec) + validación en vivo en frontend |
| Conexión frontend ↔ backend | Cliente API tipado + capa de servicios (ideal: tipos desde el OpenAPI) |
| Organizaciones | Incluidas como fase del plan (cimiento del SaaS) |
| Buscador | Filtros del backend (game/format/owner/org/leader) + paginación, sin texto libre |
| UI | Astro + React |
| Estilos | Tailwind CSS v4 |
| Editor de mazos | Búsqueda + lista cantidad/nombre, con leader/partner cuando el formato lo requiera |
| Alcance SaaS | Roadmap al final del plan; orgs ya en el plan como preparación |
