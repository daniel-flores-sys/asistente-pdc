# Proyecto COM610 — Trabajando en la Nube

## Título
Sistema de Generación de Planificaciones Curriculares con Arquitectura de Microservicios en Contenedores

---

## Objetivo General
Diseñar e implementar un sistema distribuido de microservicios para la generación automatizada de Planes de Desarrollo Curricular (PDC) para docentes bolivianos, aplicando principios de infraestructura cloud con contenedores Docker, orquestación y elasticidad con Docker Swarm, y un pipeline de integración y despliegue continuo (CI/CD) con GitHub Actions.

---

## Descripción del Proyecto
El sistema permite a docentes generar planificaciones pedagógicas mensuales personalizadas mediante inteligencia artificial local. Está compuesto por cuatro microservicios independientes:

- **ms-frontend:** Interfaz web para que el docente configure y descargue su planificación.
- **ms-orchestrator:** Coordina el flujo entre servicios, construye el prompt y gestiona la respuesta.
- **ms-ai-generator:** Procesa el prompt con un modelo de lenguaje local (Ollama/Gemma 4B) y devuelve la planificación en formato JSON validado.
- **ms-doc-processor:** Mapea el JSON generado a la plantilla oficial boliviana y produce el documento Word descargable.

Cada microservicio se despliega en contenedores Docker con una imagen optimizada publicada en DockerHub.

La infraestructura implementa **Docker Swarm** para elasticidad horizontal y tolerancia a fallos, permitiendo escalar réplicas de cualquier servicio en caliente y redistribuir carga automáticamente ante la caída de un nodo. El pipeline CI/CD con **GitHub Actions** automatiza la construcción y publicación de imágenes en cada push al repositorio, asegurando entregas continuas y reproducibles.

---

## Tecnologías a Emplear

| Capa | Tecnología |
|---|---|
| Frontend | React + Tailwind CSS |
| Orquestador | NestJS (TypeScript) |
| IA Generativa | FastAPI (Python) + Ollama (Gemma 4B) + Pydantic |
| Generador de Documentos | Python + python-docx |
| Base de Datos | PostgreSQL |
| Contenedores | Docker Engine |
| Orquestación y Elasticidad | Docker Swarm |
| CI/CD | GitHub Actions + DockerHub |
| Control de Versiones | Git + GitHub |

---

## Miembro del Grupo
**Erik Daniel Flores Medina**
Materia: COM610 Trabajando en la Nube

---

## Requisitos Técnicos para la Máquina Virtual

**Solicitud para el Ingeniero de Infraestructura**

Se requiere una máquina virtual para el despliegue de un sistema de microservicios con Docker Swarm e inteligencia artificial local (modelo de lenguaje Gemma 4B vía Ollama).

```
Sistema Operativo : Ubuntu Server 22.04 LTS
RAM               : 24 GB
                    (≈8 GB modelo Gemma 4B, ≈4 GB contenedores activos,
                     ≈4 GB sistema operativo, ≈8 GB margen y crecimiento)
vCPU              : 8 cores
Almacenamiento    : 100 GB SSD
                    (OS ~20 GB | Modelo IA ~8 GB | Imágenes Docker ~20 GB
                     Datos generados ~10 GB | Margen ~42 GB)
Red               : IP pública accesible desde internet
Puertos requeridos:
  22    → SSH (administración)
  80    → HTTP (acceso al sistema)
  2376  → Docker API TLS
  2377  → Docker Swarm manager (gestión del cluster)
  7946  → Comunicación entre nodos Swarm (TCP/UDP)
  4789  → Overlay network Swarm (UDP)
Software previo   : Docker Engine 26+, Git
```

> **Nota:** Los puertos 2377, 7946 y 4789 son requeridos por Docker Swarm para la orquestación del cluster y la red overlay entre contenedores distribuidos.
