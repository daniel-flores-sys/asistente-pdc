# Server 2 — Ollama (Modelo de Lenguaje)

## Datos del servidor

| Campo | Valor |
|---|---|
| IP privada | 192.168.100.246 |
| Usuario SSH | admin246 |
| Acceso | Solo vía bastión: `ssh -J usrproxy@201.131.45.42 admin246@192.168.100.246` |
| SO | Ubuntu 22.04 LTS |
| RAM | 24 GB |
| Rol | **SOLO** Ollama + modelo Gemma |

> Este servidor **no corre Docker ni microservicios** de la aplicación.
> Su única función es servir el modelo de lenguaje a ms-ai-generator vía HTTP.

---

## Por qué un servidor dedicado para Ollama

Gemma 4B requiere ~4-5 GB de RAM solo para el modelo. Con `OLLAMA_KEEP_ALIVE=-1` el modelo
permanece cargado indefinidamente. Si corriera en Server 1 junto a todos los microservicios
competiría por RAM y causaría latencia impredecible. Server 2 dedicado garantiza que el modelo
siempre está en RAM listo para responder.

---

## Instalación de Ollama

```bash
# En Server 2
curl -fsSL https://ollama.com/install.sh | sh

# Verificar instalación
ollama --version
```

---

## Configuración crítica — mantener modelo en RAM

Editar el service de systemd para configurar variables de entorno:

```bash
sudo systemctl edit ollama
```

Agregar dentro de las marcas `[Service]`:

```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_KEEP_ALIVE=-1"
Environment="OLLAMA_NUM_PARALLEL=2"
Environment="OLLAMA_MAX_LOADED_MODELS=1"
```

Aplicar y verificar:

```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
sudo systemctl status ollama
```

**Por qué cada variable:**

| Variable | Valor | Razón |
|---|---|---|
| `OLLAMA_HOST` | `0.0.0.0:11434` | Escucha en todas las interfaces, no solo localhost |
| `OLLAMA_KEEP_ALIVE` | `-1` | El modelo **nunca** se descarga de RAM (sin idle timeout) |
| `OLLAMA_NUM_PARALLEL` | `2` | Permite 2 requests concurrentes sin queue |
| `OLLAMA_MAX_LOADED_MODELS` | `1` | Solo 1 modelo en RAM — evita que Ollama cargue un segundo y fragmente la RAM |

> **CRÍTICO:** Sin `OLLAMA_KEEP_ALIVE=-1`, Ollama descarga el modelo de RAM tras 5 minutos
> de inactividad. La próxima solicitud tardaría 30-60 segundos en recargar el modelo,
> haciendo que la generación de PDC parezca colgada para el docente.

---

## Descargar el modelo

```bash
# Descargar Gemma 3 4B (recomendado — balance calidad/velocidad)
ollama pull gemma3:4b

# Verificar que está disponible
ollama list

# Probar respuesta
ollama run gemma3:4b "Hola, responde brevemente: ¿qué es un PDC boliviano?"
```

**Tamaño aproximado del modelo:** ~3 GB en disco, ~4-5 GB en RAM al cargar.

---

## Firewall (UFW)

```bash
# Solo SSH desde bastión y Ollama desde Server 1
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp                                    # SSH via bastión
sudo ufw allow from 192.168.100.245 to any port 11434   # Solo Server 1 accede a Ollama
sudo ufw enable
```

> **No exponer puerto 11434 a Internet.** El modelo no tiene autenticación y podría ser
> abusado para generar texto de forma gratuita.

Verificar reglas:
```bash
sudo ufw status numbered
```

---

## Verificar que Ollama responde desde Server 1

Desde Server 1 (no desde fuera), ejecutar:

```bash
curl http://192.168.100.246:11434/api/generate \
  -d '{"model":"gemma3:4b","prompt":"Responde en una palabra: ¿color del cielo?","stream":false}'
```

Respuesta esperada en <5 segundos (modelo ya cargado): `{"response":"Azul",...}`

---

## Mantenimiento

```bash
# Ver logs de Ollama en tiempo real
sudo journalctl -u ollama -f

# Ver uso de RAM del modelo
ps aux | grep ollama
free -h

# Reiniciar Ollama (recarga el modelo automáticamente al primer request)
sudo systemctl restart ollama

# Actualizar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Actualizar el modelo (nueva versión de gemma)
ollama pull gemma3:4b
```

---

## Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| Primera respuesta tarda >30 segundos | Modelo no estaba en RAM (KEEP_ALIVE no configurado) | Verificar `OLLAMA_KEEP_ALIVE=-1` en systemd |
| `connection refused` desde Server 1 | Ollama solo escucha en localhost | Verificar `OLLAMA_HOST=0.0.0.0:11434` |
| OOM Killer mata Ollama | RAM insuficiente para modelo + SO | Verificar que no hay otros procesos pesados. 24 GB debe ser suficiente para gemma3:4b |
| Ollama no inicia tras reboot | systemd no habilitado | `sudo systemctl enable ollama` |
