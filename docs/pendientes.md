# Pendientes

Datos faltantes y tareas abiertas. Ningún dato se inventa: mientras falte, el seed deja el campo vacío o el elemento oculto, y en la interfaz del panel figura como `TODO`. Antes de publicar en producción no puede quedar ningún `TODO` visible.

## Contenido

### Perfil
- [ ] Foto (JPG, PNG o WebP).
- [ ] Frase de valor (`valueProp`).
- [ ] Titular definitivo, que mencione backend y COBOL/mainframe.
- [ ] Resumen (`summary`).
- [ ] Texto de disponibilidad.
- [ ] Email público, y si se muestra o no.

### CV
- [ ] PDF del perfil `backend`.
- [ ] PDF del perfil `mainframe`.
- [ ] PDF del perfil `soporte`.
- [ ] Cuál es el CV principal (`/cv`).

### Skills
- [ ] Nivel (básico, intermedio o sólido) de cada skill, incluida **TypeScript** (agregada a Backend). Hasta confirmarlo, cada skill queda con `published = false`.
- [ ] Qué skills se muestran.
- [ ] Vínculos skill → proyecto.

### Proyectos
Para cada uno: **equipo** (individual o grupal), **origen** (académico, personal o profesional) y si es **destacado**.

| Proyecto | Pendiente |
|---|---|
| appFut | stack, demo, repo, equipo y origen |
| Menú digital | stack, demo, repo y aviso "proyecto personal sin afiliación con ninguna marca" también en la demo (repositorio aparte) |
| Sweet Medical | repo, equipo |
| Simulador de sistema operativo | repo, equipo |
| Formación mainframe | repo con ejemplos |
| Este portfolio | agregarlo como proyecto cuando esté publicado |

Para todos: contexto, solución, arquitectura, decisiones, dificultades y aprendizajes del detalle, y las imágenes con texto alternativo.

### Educación y certificaciones
- [ ] Link de la certificación Desarrollador COBOL (Codeki y FCE UBA, 2025).
- [ ] Link de la certificación Desarrollador Full Stack Junior (Argentina Programa 4.0, 2023).

## Infraestructura (Fase 5)
- [ ] Proveedor de VPS (propuesta con costo en la Fase 5).
- [ ] Dominio (propuesta en la Fase 5).
- [ ] Destino externo de los backups.
- [ ] Cuenta de Gmail y contraseña de aplicación para el SMTP (Fase 4). Nunca se versionan.

## Técnicos
- [ ] Fijar las versiones exactas de las dependencias con `npm view` al iniciar la Fase 1.
- [ ] Documentar la instalación desde cero en el README (Fase 1).
- [ ] Completar el respaldo y la recuperación de secretos en [seguridad](seguridad.md) (Fase 5).
