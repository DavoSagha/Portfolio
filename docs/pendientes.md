# Pendientes

Datos faltantes y tareas abiertas. Ningún dato se inventa: mientras falte, el seed deja el campo vacío o el elemento oculto, y en la interfaz del panel figura como `TODO`. Antes de publicar en producción no puede quedar ningún `TODO` visible.

En la base, los textos faltantes llevan el prefijo `TODO:` y los enumerados o URLs faltantes quedan en `null` ([D-024](decisiones.md#d-024-datos-pendientes-explícitos-no-inventados)). Para ver la lista actualizada desde la base: `npm run content:todos -w apps/api`.

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
- [ ] Cuál es el CV principal (`/cv`). Mientras tanto, el seed deja `backend` porque es el perfil principal.

### Skills

- [ ] Nivel (básico, intermedio o sólido) de cada skill, incluida **TypeScript** (agregada a Backend). Hasta confirmarlo, cada skill queda con `published = false`.
- [ ] Qué skills se muestran.
- [ ] Vínculos skill → proyecto.

### Proyectos

Para cada uno: **equipo** (individual o grupal), **origen** (académico, personal o profesional) y si es **destacado**. El seed marca los cinco como destacados, en el orden indicado, hasta que se elija cuáles mostrar en el inicio.

| Proyecto                       | Pendiente                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| appFut                         | stack, demo, repo, equipo y origen                                                                                      |
| Menú digital            | stack, demo, repo, equipo y aviso "proyecto personal sin afiliación con ninguna marca" también en la demo (repositorio aparte) |
| Sweet Medical                  | repo, equipo                                                                                                            |
| Simulador de sistema operativo | repo, equipo                                                                                                            |
| Formación mainframe            | repo con ejemplos, equipo y rol                                                                                         |
| Este portfolio                 | agregarlo como proyecto cuando esté publicado                                                                           |

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

- [x] Fijar las versiones exactas de las dependencias con `npm view` ([D-023](decisiones.md#d-023-versiones-fijadas-en-la-fase-1)).
- [x] Documentar la instalación desde cero en el README.
- [ ] Registro de eventos (`CV_DOWNLOAD`, visitas) y exclusión de las visitas del admin (Fase 4).
- [ ] CSP de la web con nonce y revisión de cabeceras (Fase 5). La API ya tiene la CSP más estricta.
- [ ] 8 vulnerabilidades moderadas en herramientas de desarrollo (`minimatch`, vía plugins de ESLint). No afectan a producción (`npm audit --omit=dev` da 0). Revisar cuando los plugins publiquen versiones compatibles, sin forzar.
- [ ] Completar el respaldo y la recuperación de secretos en [seguridad](seguridad.md) (Fase 5).
