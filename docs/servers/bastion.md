# Servidor Bastión

## Datos del servidor

| Campo | Valor |
|---|---|
| IP pública | 201.131.45.42 |
| Usuario SSH | usrproxy |
| SO | Ubuntu 22.04 LTS |
| Rol | Jump host SSH + nginx reverse proxy hacia Server 1 |

---

## Función

El bastión **no corre ningún microservicio de la aplicación**. Su único rol es:

1. **Aceptar conexiones SSH externas** (GitHub Actions, desarrollador) y reenviarlas a la red privada vía ProxyJump
2. **nginx reverse proxy HTTP** — recibe tráfico en puerto 80 y lo reenvía a Server 1 (:80)

```
Internet ──→ Bastión :80  ──→  192.168.100.245:80  ──→  ms-frontend:3000
Internet ──→ Bastión :22  ──→  SSH ProxyJump a 192.168.100.245 / .246
```

---

## Configuración nginx

Archivo: `/etc/nginx/sites-enabled/pdc`

```nginx
server {
    listen 80;
    server_name _;

    # Proxy hacia Server 1 — nginx local que sirve el frontend
    location / {
        proxy_pass http://192.168.100.245:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (necesario para hot-reload en dev y posibles SSE)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts generosos para generación de PDC (proceso lento con LLM)
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }
}
```

**Verificar configuración:**
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Firewall (UFW)

```bash
# Estado esperado
sudo ufw status

# To                         Action      From
# 22/tcp                     ALLOW IN    Anywhere
# 80/tcp                     ALLOW IN    Anywhere
# 443/tcp                    ALLOW IN    Anywhere   # futuro HTTPS
```

> No exponer el puerto 2377, 7946 ni 4789 al exterior. Esos puertos son solo para comunicación inter-servidor en la red privada.

---

## SSH ProxyJump

Para conectarse a Server 1 o Server 2 desde fuera:

```bash
# Conectarse a Server 1
ssh -J usrproxy@201.131.45.42 admin245@192.168.100.245

# Conectarse a Server 2
ssh -J usrproxy@201.131.45.42 admin246@192.168.100.246
```

**Configuración recomendada en `~/.ssh/config`:**
```
Host bastion
    HostName 201.131.45.42
    User usrproxy
    IdentityFile ~/.ssh/id_rsa_bastion

Host server1
    HostName 192.168.100.245
    User admin245
    ProxyJump bastion
    IdentityFile ~/.ssh/id_rsa_server

Host server2
    HostName 192.168.100.246
    User admin246
    ProxyJump bastion
    IdentityFile ~/.ssh/id_rsa_server
```

Luego simplemente: `ssh server1` o `ssh server2`

---

## Seguridad

- **Solo autenticación por llave SSH** — deshabilitar password auth en `/etc/ssh/sshd_config`:
  ```
  PasswordAuthentication no
  PubkeyAuthentication yes
  PermitRootLogin no
  ```
- **fail2ban** instalado: bloquea IPs tras 5 intentos fallidos SSH
- El bastión **no tiene acceso a la BD** — no hay puertos de PostgreSQL expuestos hacia él
- Las credenciales de la aplicación nunca se almacenan en el bastión

---

## Mantenimiento

```bash
# Ver logs de nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Reiniciar nginx
sudo systemctl restart nginx

# Ver conexiones activas
ss -tlnp | grep -E '80|22|443'
```
