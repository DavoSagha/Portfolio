# Diseño

Objetivo: un reclutante entiende en menos de 10 segundos quién es la persona, qué puesto busca y qué hizo, y puede descargar el CV con un clic. El tono es moderno, sobrio y profesional, con personalidad y sin aspecto de plantilla.

## Direcciones evaluadas

### A. Editorial técnico (descartada)

- **Estilo:** claro tipo papel, títulos serif y mucho aire.
- **Paleta:** fondo `#F6F4EF`, texto `#1C1B19`, texto secundario `#5C5A55`, acento terracota `#9A3412`, bordes `#DDD8CE`.
- **Tipografías:** Newsreader (títulos), Public Sans (texto) y JetBrains Mono (etiquetas).
- **Por qué se descartó:** comunica bien "autor", pero conecta menos con el perfil backend y mainframe.

### B. Consola mainframe, versión sobria (elegida)

Toma como referencia las terminales 3270 por la paleta (fondo oscuro, ámbar y verde) y por la monoespaciada como acento. **No simula una terminal**:

- Sin prompts (`>`), sin cursor parpadeante, sin efecto de tipeo ni texto en minúsculas con guiones bajos.
- Navegación y contenido convencionales y legibles.
- La monoespaciada se usa solo en etiquetas, fechas, chips de tecnología y fragmentos de código.

El titular deja claro el doble objetivo: puestos de backend (JavaScript/TypeScript, Go) y de COBOL/mainframe.

## Design tokens

Todos los valores visuales viven en tokens: variables CSS en `:root` y `[data-theme]`, expuestas a Tailwind 4 con `@theme`. Los componentes usan solo tokens (`bg-surface`, `text-muted`, `font-mono`…), nunca valores sueltos. Así el estilo se puede cambiar sin reescribir componentes.

### Color

El modo oscuro es el predeterminado. El modo claro se aplica con `prefers-color-scheme: light` o con un selector manual guardado en `localStorage`.

| Token                     | Oscuro    | Claro     | Uso                                 |
| ------------------------- | --------- | --------- | ----------------------------------- |
| `--color-bg`              | `#0E1311` | `#F7F8F6` | fondo de página                     |
| `--color-surface`         | `#151C19` | `#FFFFFF` | tarjetas, paneles                   |
| `--color-text`            | `#E4E7E2` | `#16201B` | texto principal                     |
| `--color-muted`           | `#9AA59F` | `#55615A` | texto secundario, metadatos         |
| `--color-accent`          | `#E8A33D` | `#8A5A00` | CTA principal, links, foco          |
| `--color-accent-contrast` | `#0E1311` | `#F7F8F6` | texto sobre el acento               |
| `--color-secondary`       | `#6FBF8E` | `#2F6B47` | estados ("publicado", "disponible") |
| `--color-danger`          | `#F2877A` | `#B3261E` | errores de formulario               |
| `--color-border`          | `#2A3530` | `#D5DBD7` | separadores decorativos             |
| `--color-border-strong`   | `#66736C` | `#7A867F` | bordes de inputs y controles        |

### Contraste

Ratios WCAG 2.2, calculados con la fórmula de luminancia relativa.

| Par                               | Oscuro | Claro | Requisito      |
| --------------------------------- | ------ | ----- | -------------- |
| texto / fondo                     | 15.03  | 15.69 | AA texto ≥ 4.5 |
| texto / superficie                | 13.88  | 16.71 | ≥ 4.5          |
| secundario (muted) / fondo        | 7.37   | 6.08  | ≥ 4.5          |
| secundario (muted) / superficie   | 6.81   | 6.47  | ≥ 4.5          |
| acento / fondo (links)            | 8.69   | 5.56  | ≥ 4.5          |
| acento-contrast / acento (botón)  | 8.69   | 5.56  | ≥ 4.5          |
| verde / fondo                     | 8.50   | 5.95  | ≥ 4.5          |
| danger / fondo                    | 7.61   | 6.14  | ≥ 4.5          |
| border-strong / fondo (controles) | 3.78   | 3.56  | UI ≥ 3         |
| border-strong / superficie        | 3.49   | 3.79  | UI ≥ 3         |

`--color-border` (1.3–1.5) se usa solo en separadores decorativos, nunca como único indicador de un control.

### Tipografía

- **Familias:**
  - `--font-sans`: IBM Plex Sans (400, 500, 600). Texto y títulos.
  - `--font-mono`: IBM Plex Mono (400, 500). Solo acentos.
- **Carga:** auto-hospedadas con `next/font` (sin requests a terceros), `display: swap` y subconjunto latino.
- **Escala** (mobile → desktop):

  | Elemento       | Tamaño          | Interlineado | Peso                                 |
  | -------------- | --------------- | ------------ | ------------------------------------ |
  | Cuerpo         | 1 rem           | 1.6          |                                      |
  | Pequeño        | 0.875 rem       |              |                                      |
  | h3             | 1.25 rem        |              | 600                                  |
  | h2             | 1.5 → 2 rem     |              | 600                                  |
  | h1             | 2.25 → 3.25 rem | 1.1          | 600                                  |
  | Etiquetas mono | 0.8125 rem      |              | mayúsculas, `letter-spacing: 0.06em` |

- El largo de línea del texto corrido es de 65 caracteres como máximo.

### Espaciado, radios y movimiento

- **Espaciado:** escala de 4 px: `--space-1` 0.25 rem … `--space-16` 4 rem. Las secciones se separan con `--space-16` en desktop y `--space-12` en mobile.
- **Contenedor:** `max-width: 72rem` con 1 rem de margen lateral en mobile.
- **Radios:** `--radius-sm` 4 px (chips) y `--radius-md` 8 px (tarjetas, botones). Las esquinas son casi rectas, coherentes con la estética de terminal.
- **Movimiento:**
  - Transiciones de 150 ms solo en hover y foco.
  - Con `prefers-reduced-motion: reduce`, todas las transiciones se desactivan.
  - Sin carruseles, partículas, efecto de tipeo ni animaciones de entrada largas.
- **Foco:** `outline` de 2 px con `--color-accent` y `offset` de 2 px, siempre visible con teclado.

## Estructura del sitio público

Mobile first. Cada sección se renderiza solo si `sections.<nombre>` es verdadero.

1. **Inicio (hero):**
   - Nombre y titular.
   - Frase de valor y chips mono con el stack principal (`JS/TS · Go · COBOL`).
   - Ubicación (CABA) y disponibilidad.
   - Foto.
   - Botones: **Descargar CV** (acento, principal), **Ver proyectos** y **Contactarme**.
   - Links a LinkedIn y GitHub con nombre accesible.
2. **Proyectos destacados.** Tarjetas con:
   - Título.
   - Problema en una línea.
   - Rol.
   - Etiqueta mono de equipo y origen (`GRUPAL · PERSONAL`).
   - Tecnologías.
   - Links a demo y código si existen.
   - El aviso (`disclaimer`) destacado cuando corresponde.
3. **Detalle de proyecto** (`/proyectos/:slug`): contexto, problema, solución, arquitectura, decisiones, dificultades, aprendizajes y limitaciones.
4. **Trayectoria.** Línea de tiempo vertical con fechas en mono. El tipo (experiencia, educación o certificación) se marca con una etiqueta de texto, no solo con color.
5. **Skills.** Agrupadas por categoría. El nivel va en texto ("sólido", "intermedio", "básico"), sin barras ni porcentajes. Cada skill enlaza a los proyectos donde se usó.
6. **Idiomas.** Lista simple con el nivel MCER.
7. **Contacto.** Formulario con etiquetas visibles, errores asociados con `aria-describedby` y un honeypot oculto para lectores de pantalla (`aria-hidden`, `tabindex="-1"`). El email se muestra solo si está habilitado desde el panel.

## Acceso al panel

El footer tiene un link discreto "Acceso", en texto y sin destacar. Con sesión activa se reemplaza por "Panel" y "Cerrar sesión", salvo dentro del panel, donde queda solo su navegación lateral. El navbar no cambia ([D-032](decisiones.md#d-032-acceso-al-panel-desde-el-footer)).

## Panel de administración

- Usa los mismos tokens, con una densidad mayor.
- **Navegación:** lateral en desktop y menú simple en mobile.
- **Formularios:** solo envían a la API y muestran sus errores. No contienen reglas de negocio.

## Accesibilidad y SEO

- HTML semántico, un solo `h1` por página, "saltar al contenido", `lang="es"` y contraste AA verificado (tabla de arriba).
- Imágenes con `alt` obligatorio desde el panel. La foto se sirve con `next/image` y tamaños responsivos.
- **Metadatos:** `title` y `description` por página, y Open Graph con la imagen del perfil o la portada del proyecto.
- **Indexación:** `sitemap.xml` generado desde las rutas publicadas. `/admin` queda fuera del sitemap y envía `noindex`, y `robots.txt` no lo bloquea para que los buscadores puedan leer ese `noindex`.
- **Objetivo:** Lighthouse mobile ≥ 90 en rendimiento, accesibilidad, buenas prácticas y SEO (se mide en la Fase 5).
