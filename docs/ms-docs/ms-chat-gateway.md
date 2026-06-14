# ms-chat-gateway

**Tecnología:** Python 3.11 + python-telegram-bot (Telegram) / whatsapp-web.js (WhatsApp)  
**Puerto interno:** 8004  
**Imagen prod:** `python:3.11-slim` (multi-stage build)

---

## Responsabilidad

Puente entre los canales de mensajería (Telegram o WhatsApp) y el sistema de generación de PDC. Recibe mensajes del docente por el canal de chat, los enruta al ms-orchestrator, y devuelve las respuestas al docente por el mismo canal.

También verifica que el número de teléfono del usuario en la plataforma de mensajería coincida con el celular registrado en la base de datos — esto garantiza que cada usuario solo usa su propia cuenta.

---

## Decisión de canal: Telegram vs WhatsApp

| Criterio | Telegram | WhatsApp (whatsapp-web.js) |
|---|---|---|
| Costo | Gratuito, API oficial | Gratuito (usa tu número personal) |
| Estabilidad | Alta — API oficial de Telegram | Media — depende de que el teléfono esté conectado |
| Riesgo de ban | Ninguno | Riesgo real si Meta detecta automatización |
| Instalación | Solo necesita `BOT_TOKEN` | Necesita escanear QR en el teléfono del servidor |
| Verificación de identidad | `chat.id` del usuario | Número de teléfono directo |
| Recomendación | **Usar para producción** | Solo si los usuarios no tienen Telegram |

**Decisión recomendada: Telegram como canal principal.**

Si se necesita WhatsApp adicionalmente, se puede agregar `whatsapp-web.js` como canal secundario en el mismo servicio (ver sección WhatsApp más abajo). Ambos canales pueden coexistir.

---

## Flujo de verificación de identidad

Cuando un usuario escribe por primera vez al bot:

```
Usuario → "/start"
Bot → "Hola, para usar este servicio debes estar registrado.
       ¿Cuál es tu número de celular registrado? (formato: 70123456)"

Usuario → "70123456"
Bot → verifica contra la tabla usuarios WHERE celular = '70123456'

Si encontrado y activo:
  Bot → "Bienvenido, {nombre}. Tienes {intentos} planificaciones disponibles."
  Guarda chat_id ↔ usuario_id en tabla chat_sessions

Si no encontrado:
  Bot → "Este número no está registrado. Contacta al administrador en [tu contacto]."

Si cuenta inactiva:
  Bot → "Tu cuenta está suspendida. Contacta al administrador."
```

Una vez vinculado, el `chat_id` de Telegram (o número de WhatsApp) queda asociado al `usuario_id`. En las siguientes sesiones, el usuario ya no necesita re-identificarse.

---

## Tabla `chat_vinculaciones` (PostgreSQL)

```sql
CREATE TABLE chat_vinculaciones (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER REFERENCES usuarios(id) UNIQUE,
  canal       VARCHAR(20) NOT NULL,           -- 'telegram' | 'whatsapp'
  chat_id     VARCHAR(100) NOT NULL,          -- ID del chat en Telegram o número en WhatsApp
  activo      BOOLEAN DEFAULT TRUE,
  vinculado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Comandos del bot (Telegram)

| Comando | Descripción |
|---|---|
| `/start` | Inicia el proceso de vinculación o saluda si ya está vinculado |
| `/generar` | Inicia el flujo de generación de PDC |
| `/intentos` | Muestra créditos disponibles restantes |
| `/historial` | Lista los últimos 5 PDCs generados con link de descarga |
| `/cancelar` | Cancela la sesión activa de generación |
| `/ayuda` | Muestra los comandos disponibles |

---

## Flujo de generación por chat

```
1. Usuario → /generar
   Bot → "Vamos a generar tu PDC. ¿Cuál es tu nombre completo y título? (ej: Lic. Ana Quispe)"

2. El bot recolecta los datos del formulario en turnos de chat:
   - Nombre y título
   - CI
   - Unidad educativa
   - Año de escolaridad y trimestre
   - Áreas curriculares (se muestran como opciones numeradas)
   - Temas por área

3. Una vez recolectados los datos del formulario:
   Bot → llama a POST /api/generate/start en el ms-orchestrator
   Bot → continúa el chat conversacional (preguntas de la IA)

4. Cuando la IA indica listo_para_generar:
   Bot → "¿Confirmamos la generación? Responde SI para continuar."

5. Usuario → "SI"
   Bot → llama a POST /api/generate/confirm
   Bot → "¡Tu planificación está lista! Descárgala aquí: [URL]"
   Bot → "Te quedan {N} planificaciones disponibles."
```

---

## Implementación Telegram

```python
# Usando python-telegram-bot v20+ (async)
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters

class TelegramGateway:
    def __init__(self, token: str, orchestrator_url: str):
        self.app = Application.builder().token(token).build()
        self.orchestrator = OrchestratorClient(orchestrator_url)
        self._register_handlers()

    def _register_handlers(self):
        self.app.add_handler(CommandHandler("start", self.cmd_start))
        self.app.add_handler(CommandHandler("generar", self.cmd_generar))
        self.app.add_handler(CommandHandler("intentos", self.cmd_intentos))
        self.app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))

    async def handle_message(self, update: Update, context):
        chat_id = str(update.effective_chat.id)
        usuario = await self.get_usuario_vinculado(chat_id)

        if not usuario:
            # En proceso de vinculación
            await self.proceso_vinculacion(update, context)
            return

        session = await self.get_sesion_activa(usuario["id"])
        if not session:
            await update.message.reply_text("Usa /generar para iniciar una planificación.")
            return

        # Continuar el chat de generación
        response = await self.orchestrator.chat(
            session_id=session["session_id"],
            mensaje=update.message.text,
            usuario_token=session["token"]
        )
        await update.message.reply_text(response["respuesta"])

        if response["listo_para_generar"]:
            await update.message.reply_text("Responde SI para generar tu planificación.")
```

---

## Implementación WhatsApp (whatsapp-web.js)

> **Nota:** esta opción requiere un teléfono (o número) dedicado permanentemente conectado. Si el teléfono pierde conexión, el bot deja de funcionar. Solo recomendado si los usuarios no tienen Telegram.

El servicio incluye un subproceso Node.js que corre whatsapp-web.js y expone un webhook interno hacia el servidor FastAPI principal:

```
[WhatsApp Cloud] ↔ [whatsapp-web.js (Node.js subproceso)] ↔ [FastAPI webhook] ↔ [ms-orchestrator]
```

Para iniciar, se necesita escanear el QR:
```bash
docker exec -it pdc_ms-chat-gateway node whatsapp/start.js
# El QR aparece en la terminal — escanear con el teléfono configurado
# Una vez escaneado, la sesión se guarda en /app/whatsapp/.wwebjs_auth/
```

La sesión persiste en un volumen Docker para sobrevivir reinicios del contenedor.

---

## Comunicación con ms-orchestrator

El chat gateway no tiene lógica de negocio. Todo lo delega:

```
POST http://ms-orchestrator:3001/api/auth/login-chat
  { "usuario_id": 5, "canal": "telegram", "chat_id": "123456789" }
  → { "token": "jwt..." }  (token de corta duración para esta sesión de chat)

POST http://ms-orchestrator:3001/api/generate/start
  Authorization: Bearer {token}
  { "canal": "telegram" }
  → { "session_id": "uuid" }

POST http://ms-orchestrator:3001/api/generate/chat
  Authorization: Bearer {token}
  { "session_id": "uuid", "mensaje": "..." }
  → { "respuesta": "...", "listo_para_generar": false }
```

---

## Variables de entorno

```env
PORT=8004
ENVIRONMENT=development

# Telegram (requerido si se usa Telegram)
TELEGRAM_BOT_TOKEN=

# WhatsApp (requerido si se usa whatsapp-web.js)
WHATSAPP_ENABLED=false
WHATSAPP_SESSION_DIR=/app/whatsapp/.wwebjs_auth

# Orchestrator
ORCHESTRATOR_URL=http://ms-orchestrator:3001

# PostgreSQL
DATABASE_URL=postgresql://genplan_user:genplan_pass@postgres:5432/genplan_db

# Mensaje de contacto para usuarios no registrados
ADMIN_CONTACT=https://wa.me/591XXXXXXXX
```

---

## Estructura de carpetas

```
src/
├── domain/
│   └── schemas/
│       └── chat_session.py      # VinculacionRequest, ChatMessage
├── application/
│   ├── telegram_handlers.py     # CommandHandlers y MessageHandlers
│   └── whatsapp_handlers.py     # Lógica para mensajes de WhatsApp
├── infrastructure/
│   ├── orchestrator_client.py   # HTTP client hacia ms-orchestrator
│   ├── db.py                    # Pool pg
│   └── vinculacion_repo.py      # CRUD en chat_vinculaciones
├── whatsapp/                    # Solo si WHATSAPP_ENABLED=true
│   ├── start.js                 # Script Node.js para whatsapp-web.js
│   └── package.json
└── main.py                      # Inicia Telegram bot + FastAPI (health endpoint)
```

---

## Creación del bot en Telegram

1. Abrir Telegram y buscar `@BotFather`
2. Enviar `/newbot`
3. Asignar nombre: `Asistente PDC Bolivia`
4. Asignar username: `asistente_pdc_bot` (o cualquiera disponible)
5. Copiar el token y guardarlo en `TELEGRAM_BOT_TOKEN`

El bot no requiere ningún servidor accesible desde internet — usa long polling para recibir mensajes.

---

## Notas de diseño

- **Por qué el bot usa long polling y no webhook:** los webhooks requieren HTTPS con certificado válido y un servidor expuesto a internet. El long polling funciona detrás de NAT, en una red privada, y no requiere dominio. Para producción con alta carga se puede migrar a webhook.
- **Por qué la verificación es por número de celular y no por username de Telegram:** el username de Telegram es opcional y puede cambiarse. El número de celular es el identificador único en el modelo de negocio y es lo que el admin configura al dar acceso.
- **Por qué guardar el chat_id en la DB y no en memoria:** si el servicio se reinicia (por Swarm, actualización, etc.), las vinculaciones persisten. El usuario no necesita re-vincularse.
- **Por qué el token JWT del chat gateway es de corta duración:** el canal de mensajería no tiene logout explícito. Un token que expira en 30 minutos de inactividad limita el riesgo si alguien obtiene acceso al chat de Telegram de otro docente.
