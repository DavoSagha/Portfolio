# Pendientes

Datos faltantes y tareas abiertas. Ningún dato se inventa: mientras falte, el seed deja el campo vacío o el elemento oculto, y en la interfaz del panel figura como `TODO`. Antes de publicar en producción no puede quedar ningún `TODO` visible.

En la base, los textos faltantes llevan el prefijo `TODO:` y los enumerados o URLs faltantes quedan en `null` ([D-024](decisiones.md#d-024-datos-pendientes-explícitos-no-inventados)). Para ver la lista actualizada desde la base: `npm run content:todos -w apps/api`.

## Contenido

El perfil, las skills, los proyectos, la trayectoria y los CV están completos y confirmados. `content:todos` no informa pendientes. Lo que sigue no se muestra mientras falte.

### Perfil

- [x] Titular, frase de valor, resumen, disponibilidad, ubicación y email público.
- [x] Foto, cargada con `photo:import` y reprocesada sin metadatos ([D-028](decisiones.md#d-028-foto-de-perfil-por-consola-reprocesada)).

### CV

- [x] PDF vigentes de los perfiles `backend`, `mainframe` y `soporte`, cargados con `cv:import`. CV principal: `backend`.
- [x] Versión de prueba borrada del historial y del disco.

### Skills

- [x] Nivel de cada skill, todas publicadas. Categoría "Contenido y diseño" al final.

### Proyectos

Destacados en el inicio, en este orden: appFut, Carta digital para La Catedral del Pisco y Formación mainframe. Ningún proyecto tiene demo por ahora; se cargan desde el panel.

- [ ] Aporte propio en la carta digital: no se muestra hasta confirmarlo.
- [ ] Secciones del detalle de appFut y de la carta digital: borradores pendientes de aprobación.
- [ ] Aviso de no afiliación también en la demo de la carta digital (repositorio aparte).
- [ ] Imágenes de los proyectos, con texto alternativo.
- [ ] Este portfolio como proyecto, cuando esté publicado.

## Infraestructura (Fase 5)

- [ ] Proveedor de VPS (propuesta con costo en la Fase 5).
- [ ] Dominio (propuesta en la Fase 5).
- [ ] Destino externo de los backups.
- [ ] Cuenta de Gmail y contraseña de aplicación para el SMTP (Fase 4). Nunca se versionan.

## Técnicos

- [x] Fijar las versiones exactas de las dependencias con `npm view` ([D-023](decisiones.md#d-023-versiones-fijadas-en-la-fase-1)).
- [x] Documentar la instalación desde cero en el README.
- [x] Registro de eventos (`CV_DOWNLOAD`, visitas) y exclusión de las visitas del admin.
- [ ] Probar el envío real con la cuenta de Gmail cuando exista la contraseña de aplicación.
- [ ] Aviso de `pg` en los logs ("client.query() when the client is already executing a query"): revisar antes de actualizar a `pg` 9.
- [ ] Definir cuánto tiempo se conservan los eventos y los mensajes (hoy no se borran solos).
- [x] Al reemplazar la foto, la portada o una imagen, borrar el archivo anterior.
- [ ] CSP de la web con nonce y revisión de cabeceras (Fase 5). La API ya tiene la CSP más estricta.
- [ ] 8 vulnerabilidades moderadas en herramientas de desarrollo (`minimatch`, vía plugins de ESLint). No afectan a producción (`npm audit --omit=dev` da 0). Revisar cuando los plugins publiquen versiones compatibles, sin forzar.
- [ ] Completar el respaldo y la recuperación de secretos en [seguridad](seguridad.md) (Fase 5).
