# Pendientes

Datos faltantes y tareas abiertas. Ningún dato se inventa: mientras falte, el seed deja el campo vacío o el elemento oculto, y en la interfaz del panel figura como `TODO`. Antes de publicar en producción no puede quedar ningún `TODO` visible.

En la base, los textos faltantes llevan el prefijo `TODO:` y los enumerados o URLs faltantes quedan en `null` ([D-024](decisiones.md#d-024-datos-pendientes-explícitos-no-inventados)). Para ver la lista actualizada desde la base: `npm run content:todos -w apps/api`.

## Contenido

### Perfil

- [x] Foto, cargada con `photo:import` y reprocesada sin metadatos ([D-028](decisiones.md#d-028-foto-de-perfil-por-consola-reprocesada)).
- [ ] Frase de valor (`valueProp`).
- [ ] Texto de disponibilidad.
- [ ] Resumen (`summary`). Los CV tienen un texto de "Perfil" distinto por perfil, y falta definir cuál se usa.
- [ ] Titular. El acordado ("Backend Developer Jr · JavaScript/TypeScript · Go · COBOL") difiere del CV Backend ("Desarrollador Backend Jr | JavaScript, Node.js, Go").
- [ ] Email público, y si se muestra. Hay una dirección en los CV; mientras no se confirme, no se carga.
- [ ] Ubicación. Los CV indican barrio; el sitio usa la ubicación general ("CABA, Argentina").

### CV

- [x] PDF de los perfiles `backend`, `mainframe` y `soporte`, cargados con `cv:import`.
- [x] CV principal (`/cv`): `backend`.
- [ ] Qué hacer con la versión de prueba "Prueba local" que quedó en el historial del perfil `backend`. Ya no se descarga.

### Skills

- [ ] Nivel (básico, intermedio o sólido) de cada skill y cuáles se muestran. Las que no se confirmen quedan ocultas, incluida **TypeScript**, que no figura en ningún CV.
- [ ] Skills que aparecen en los CV pero no en la lista acordada: C++, SORT, IDCAMS, Excel, Canva, CapCut, armado de PC, cambio de pasta térmica y reemplazo de placas de video.
- [ ] Vínculos skill → proyecto (más allá de los que ya surgen de los roles).

### Proyectos

Destacados en el inicio: Sweet Medical, appFut y Formación mainframe.

| Proyecto                                      | Pendiente                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------- |
| appFut                                        | stack, demo, repo y origen. Equipo: grupal. Los CV lo indican "en desarrollo".              |
| Menú digital                           | stack, demo, repo y equipo. Aviso de no afiliación también en la demo (repositorio aparte). |
| Sweet Medical                                 | repo y equipo                                                                               |
| Simulador de sistema operativo                | repo y equipo                                                                               |
| Formación mainframe                           | repo con ejemplos y equipo                                                                  |
| Portfolio Full Stack (Argentina Programa 4.0) | figura en los CV pero no en la lista acordada: confirmar si se agrega                       |
| Este portfolio                                | agregarlo como proyecto cuando esté publicado                                               |

Para todos: contexto, problema, solución, arquitectura, decisiones, dificultades y aprendizajes del detalle, y las imágenes con texto alternativo.

### Trayectoria

- [x] Descripciones de la experiencia con la redacción de los CV.
- [x] Links de las dos certificaciones.
- [ ] "Armado y mantenimiento de PC (experiencia personal)" figura en el CV de Soporte pero no en la trayectoria acordada, y no tiene fechas.
- [ ] Mostrar o no el nombre de la directora del grupo de investigación (figura en los CV).

## Infraestructura (Fase 5)

- [ ] Proveedor de VPS (propuesta con costo en la Fase 5).
- [ ] Dominio (propuesta en la Fase 5).
- [ ] Destino externo de los backups.
- [ ] Cuenta de Gmail y contraseña de aplicación para el SMTP (Fase 4). Nunca se versionan.

## Técnicos

- [x] Fijar las versiones exactas de las dependencias con `npm view` ([D-023](decisiones.md#d-023-versiones-fijadas-en-la-fase-1)).
- [x] Documentar la instalación desde cero en el README.
- [ ] Registro de eventos (`CV_DOWNLOAD`, visitas) y exclusión de las visitas del admin (Fase 4).
- [ ] Al reemplazar la foto, borrar el archivo anterior si ya no se usa (Fase 3, con el panel).
- [ ] CSP de la web con nonce y revisión de cabeceras (Fase 5). La API ya tiene la CSP más estricta.
- [ ] 8 vulnerabilidades moderadas en herramientas de desarrollo (`minimatch`, vía plugins de ESLint). No afectan a producción (`npm audit --omit=dev` da 0). Revisar cuando los plugins publiquen versiones compatibles, sin forzar.
- [ ] Completar el respaldo y la recuperación de secretos en [seguridad](seguridad.md) (Fase 5).
