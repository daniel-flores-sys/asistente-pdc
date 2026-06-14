# ms-frontend

**Rol:** Interfaz de usuario para docentes bolivianos. Wizard de generación de PDC en 4 pasos,
historial de documentos generados y panel de administración completo.

---

## Stack

| Item | Valor |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS |
| Estado global | Zustand |
| HTTP | Axios con interceptor JWT |
| Puerto | 3000 (nginx en imagen prod) |

---

## Variables de entorno

```env
VITE_API_URL=http://localhost:3001
```

En producción, el nginx del contenedor proxy /api a ms-orchestrator, por lo que
`VITE_API_URL` puede quedar en blanco (usa relative URLs).

---

## Rutas de la aplicación

| Ruta | Componente | Acceso |
|---|---|---|
| `/` | Landing | Público |
| `/login` | Login | Público |
| `/register` | Registro docente | Público |
| `/generar` | GenerarWizard | Docente autenticado |
| `/historial` | Historial | Docente autenticado |
| `/admin` | AdminLayout | Admin autenticado |
| `/admin/documentos` | AdminDocumentos | Admin |
| `/admin/referencia` | AdminReferencia | Admin |
| `/admin/config` | AdminConfig | Admin |
| `/admin/docentes` | AdminDocentes | Admin |
| `/admin/monitor` | AdminMonitor | Admin |

---

## Wizard de generación (4 pasos)

```
Paso 1 — Datos del docente
  ├── Nombre completo (pre-llenado desde perfil)
  ├── CI / Carnet de identidad (pre-llenado)
  ├── Título académico (pre-llenado, editable)
  ├── Unidad educativa (texto libre)
  ├── Distrito educativo (texto libre)
  └── Nombre del director (texto libre, opcional)

Paso 2 — Asignación
  ├── Año de escolaridad (select: Cuarto, Quinto, etc.)
  └── Trimestre (select: Primero, Segundo, Tercero)

Paso 3 — Áreas y temas
  ├── Selección múltiple de áreas curriculares (checkboxes)
  └── Por cada área: selección de temas por semana (checkboxes o dropdowns)

Paso 4 — Contexto adicional
  ├── Materiales disponibles (textarea, opcional)
  └── Contexto social de la comunidad (textarea, opcional)

Resultado
  ├── Loading spinner mientras se genera (puede tomar 30-90 segundos)
  ├── Botón "Descargar PDC" (link a download_url)
  └── Créditos restantes mostrados
```

---

## Panel de administración

### /admin/documentos
- Lista de documentos indexados en ChromaDB
- Upload de nuevo documento (drag & drop o selector de archivo)
- Indicador de progreso de ingesta (chunks generados)
- Botón "Eliminar" por documento
- Botón "Re-indexar" por documento

### /admin/referencia
- Tabs: Niveles | Años de escolaridad | Áreas curriculares | Temas mensuales | Objetivos holísticos
- CRUD básico para cada entidad (formulario inline o modal)

### /admin/config
- Editor de parámetros LLM (temperatura, max_tokens, modelo)
- Editor de parámetros RAG (top_k, score_threshold)
- Editor de prompts del sistema (textarea con syntax highlighting via monaco-editor)

### /admin/docentes
- Tabla de docentes registrados (nombre, email, CI, créditos, activo)
- Botón "Agregar créditos" → modal con input numérico
- Toggle activo/inactivo por docente
- Crear docente manualmente

### /admin/monitor
- Tarjetas con estado de cada servicio (nombre, réplicas activas/deseadas, estado)
- Gráfico de CPU/RAM en tiempo real (polling cada 30s a `/api/admin/monitor/metrics`)
- Controles de scaling: botones +/- por servicio; botón − deshabilitado en `config.min_replicas`
- Lista de alertas recientes (scale_up, scale_down, contenedor reiniciado)
- Configuración de umbrales de auto-scaling
- **Nota de robustez**: `load()` aplica `Array.isArray` guards antes de actualizar estado.
  Si ms-monitor devuelve dato inesperado (reinicio, 502), las listas quedan en `[]` en vez de crashear.

---

## Estado global (Zustand — `src/store/useAppStore.ts`)

```typescript
interface UserProfile {
  id: number; nombre: string; email: string;
  ci: string; titulo: string;
  rol: 'docente' | 'admin';   // NOTE: inglés en backend → normalizado a español aquí
  creditos: number; activo: boolean;
}

interface AppState {
  user:           UserProfile | null
  token:          string | null
  setAuth:        (user: UserProfile, token: string) => void
  updateCreditos: (creditos: number) => void   // llamado tras generar PDC
  logout:         () => void
}
```

El store persiste en `localStorage` con clave `pdc-auth`.

## Flujo de login (`src/api.ts`)

`authLogin` ejecuta dos requests secuenciales:
1. `POST /api/auth/login` → obtiene `access_token`
2. `GET /api/auth/me` (con ese token) → obtiene perfil completo (`ci`, `titulo`, `activo`)

Esto es necesario porque el endpoint de login devuelve un perfil parcial.
El backend envía el campo como `role` (inglés); `authLogin` lo normaliza a `rol` (español) para el store.

---

## Estructura de carpetas

```
src/
├── pages/
│   ├── Landing.tsx
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── GenerarWizard.tsx      # wizard de 4 pasos en un solo componente
│   ├── Historial.tsx
│   └── admin/
│       ├── AdminLayout.tsx
│       ├── AdminDocumentos.tsx
│       ├── AdminReferencia.tsx
│       ├── AdminConfig.tsx
│       ├── AdminDocentes.tsx
│       └── AdminMonitor.tsx
├── components/
│   ├── PrivateRoute.tsx       # requiere token
│   └── AdminRoute.tsx        # requiere rol === 'admin'
├── store/
│   └── useAppStore.ts
├── api.ts                    # axios instance + interceptores JWT + tipos de dominio
├── App.tsx
└── main.tsx
```
