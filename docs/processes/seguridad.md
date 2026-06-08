# Seguridad del Sistema

---

## Autenticación y autorización

### Docentes — JWT Bearer Token

- Contraseñas hasheadas con **bcrypt** (salt rounds = 12)
- Token JWT firmado con HS256, `JWT_SECRET` en variable de entorno (nunca en código)
- Expiración: 8 horas (`JWT_EXPIRES_IN=8h`)
- El token viaja solo en el header `Authorization: Bearer <token>` (no en cookies, no en URL)
- `JwtAuthGuard` en NestJS verifica el token en todas las rutas protegidas
- Si el token expira, el cliente recibe 401 y debe hacer login de nuevo

### Administrador

- Credenciales del admin principal en variables de entorno (`ADMIN_EMAIL`, `ADMIN_PASSWORD`)
- Al iniciar la BD, se inserta un registro en la tabla `admins` con esas credenciales hasheadas (si no existe)
- Admins adicionales se crean desde el panel solo por el admin principal
- Las rutas `/api/admin/*` verifican un claim `rol: 'admin'` en el JWT
- Tabla `admins` separada de `usuarios` — no hay confusión de roles

---

## Credenciales y secrets

| Credencial | Dónde vive en desarrollo | Dónde vive en producción |
|---|---|---|
| JWT_SECRET | `.env` local (gitignored) | GitHub Secret → env var en docker-compose |
| DB_PASSWORD | `.env` local | GitHub Secret |
| AWS_ACCESS_KEY_ID | `.env` local | GitHub Secret |
| AWS_SECRET_ACCESS_KEY | `.env` local | GitHub Secret |
| ADMIN_PASSWORD | `.env` local | Variable de entorno en Server 1 |
| DOCKERHUB_TOKEN | No aplica | GitHub Secret para CI/CD |
| SSH_PRIVATE_KEY | `~/.ssh/` local | GitHub Secret (base64) |

**Regla absoluta:** Ningún secret aparece en archivos versionados en git.
Los `.env` están en `.gitignore`. Los `.env.example` tienen valores vacíos.

---

## Seguridad de red

```
Internet
  │
  │ :80, :443, :22 (solo puertos expuestos)
  ▼
Bastión (201.131.45.42)
  │
  │ nginx proxy :80 → :80
  │ SSH ProxyJump :22
  ▼
Server 1 (192.168.100.245) — red privada
  │ Solo :3000 accesible externamente (via nginx)
  │ Puertos Swarm: 2377, 7946, 4789 (solo entre servidores privados)
  │ Puertos de microservicios: 3001, 8000-8003 INTERNOS SOLO
  │
  ▼
Red overlay Docker pdc-overlay
  │ Comunicación cifrada entre contenedores
  ▼
Server 2 (192.168.100.246)
  │ Solo :11434 accesible desde 192.168.100.245
  │ No expuesto a internet en absoluto
```

---

## Docker socket — ms-monitor

ms-monitor necesita el socket de Docker para escalar servicios. Esto tiene implicaciones de seguridad:

- El socket se monta como **read-only** en lo posible: `:ro`
- El contenedor corre con el constraint `node.role == manager` — solo en el nodo que controla el Swarm
- Los endpoints de ms-monitor que escalan servicios (`POST /monitor/scale`) requieren autenticación de admin
- El socket **no está expuesto al exterior** — ms-monitor solo es accesible desde la red overlay interna (el panel admin lo llama via ms-orchestrator)

---

## Validación de inputs

### ms-orchestrator (NestJS)
- `class-validator` + `class-transformer` con `ValidationPipe(whitelist: true)` global
- `whitelist: true` descarta cualquier propiedad no declarada en el DTO — evita mass assignment
- Validaciones: tipos, longitudes, enums permitidos, campos requeridos

### ms-ai-generator y ms-doc-processor (FastAPI)
- Pydantic v2 con validación estricta de tipos
- `model_validator` para validaciones cruzadas de campos

---

## Rate limiting

En ms-orchestrator, `@nestjs/throttler`:

```typescript
// Configuración recomendada
ThrottlerModule.forRoot([{
  name: 'auth',
  ttl: 60_000,  // 1 minuto
  limit: 10,    // máximo 10 intentos de login por minuto por IP
}])
```

Aplicado en:
- `POST /api/auth/login` — evita fuerza bruta
- `POST /api/auth/register` — evita creación masiva de cuentas

---

## SQL injection

- **Nunca concatenar strings en queries SQL**
- Usar siempre queries parametrizadas:
  ```python
  # Python (psycopg2) — CORRECTO
  cursor.execute("SELECT * FROM usuarios WHERE email = %s", (email,))
  
  # INCORRECTO (nunca hacer esto)
  cursor.execute(f"SELECT * FROM usuarios WHERE email = '{email}'")
  ```
- En NestJS, usar el pool de pg con `$1, $2` placeholders
- Los datos JSONB se insertan con `%s` o `$1` — nunca se construye SQL dinámico con datos del usuario

---

## CORS

Todos los microservicios tienen CORS configurado. En producción:

```python
# FastAPI — restringir a solo el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://192.168.100.245"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

```typescript
// NestJS
app.enableCors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
});
```

> En desarrollo se puede usar `allow_origins=["*"]` para comodidad, pero en producción debe ser restrictivo.

---

## Auditoría de acciones de admin

Las acciones críticas del admin quedan registradas en logs de ms-orchestrator:
- Creación/desactivación de cuentas de docentes
- Asignación de créditos
- Subida/eliminación de documentos
- Cambios en configuración del sistema (prompts, parámetros LLM)

Los logs incluyen: timestamp, email del admin, acción, parámetros.

---

## Checklist de seguridad antes de producción

- [ ] `JWT_SECRET` tiene al menos 32 caracteres aleatorios (no una palabra simple)
- [ ] `DB_PASSWORD` no es el default `genplan_pass` de los ejemplos
- [ ] `ADMIN_PASSWORD` es fuerte (mayúsculas, números, símbolos)
- [ ] AWS IAM user tiene solo permisos S3 (no AdministratorAccess)
- [ ] `.env` NO está en git (`git status` no debe mostrar `.env`)
- [ ] UFW activo en ambos servidores (`sudo ufw status`)
- [ ] Ollama no está expuesto en el bastión (solo Server 2 red privada)
- [ ] CORS configurado con origins específicos (no `*`) en producción
