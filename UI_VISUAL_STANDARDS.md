# UI Visual Standards

Guía compacta para mantener consistencia visual en Metrion.

## Principio general
- Metrion es una herramienta operativa, no una landing.
- Las vistas deben sentirse densas, sobrias y útiles.
- Si una pantalla se ve “grande” o “hero”, probablemente está fuera de estándar.

## Referencias base
- Usar como referencia de proporción y densidad:
  - `Control del mes`
  - `Historial`
- Nuevas páginas de trabajo deben parecer del mismo ecosistema visual.

## Headers de página
- Usar `PageHeader` como patrón por defecto.
- `h1` principal:
  - `text-xl`
  - `font-semibold`
  - `tracking-tight`
- Descripción:
  - una sola línea breve
  - `text-sm`
  - sin repetir contexto que ya existe en la topbar
- Separación recomendada entre header y contenido:
  - `space-y-4` o `gap-4`
  - evitar bloques hero con demasiado aire

## Ancho útil
- No usar todo el ancho disponible solo porque existe.
- Vistas tipo tabla/operación:
  - preferir `max-w-3xl` a `max-w-[1080px]` según contenido
- Vistas de gestión o dos columnas:
  - usar un contenedor acotado
  - evitar cards enormes con mucho vacío interno
- Si una vista se siente más ancha que `Historial`, revisar proporciones.

## Topbar
- Debe acompañar, no dominar.
- Header superior:
  - altura contenida, alrededor de `54px`
- Selector de unidad:
  - alto `h-9`
  - texto alrededor de `15px`
  - ancho mínimo solo lo necesario para nombres reales
- Selector de periodo:
  - alto `h-9`
  - texto alrededor de `15px`
  - flechas laterales compactas
- Badge de estado:
  - pequeño
  - texto de `10px` a `11px`
  - peso visual secundario

## Cards
- Radio por defecto:
  - preferir `rounded-xl` o `rounded-lg`
  - evitar `rounded-[28px]` o similares salvo casos muy justificados
- Padding:
  - estándar: `p-4` o `p-5`
  - evitar `p-6+` si no hay suficiente densidad interna
- Sombras:
  - suaves y discretas
  - no usar sombras que conviertan la card en protagonista

## Títulos internos
- Título de sección/card:
  - alrededor de `text-[1.05rem]` o `text-[1.1rem]`
  - `font-semibold`
- Evitar subtítulos internos de `1.4rem+` en páginas operativas.

## Inputs y botones
- Alturas estándar:
  - inputs: `h-9` a `h-11`
  - botones principales: `h-9` a `h-10`
- Evitar controles de `h-12+` salvo una razón funcional fuerte.
- En páginas de trabajo, el botón no debe parecer banner.

## Tablas y listados
- Las filas deben sentirse compactas.
- Altura de fila:
  - preferir `py-3` o `py-4`
  - evitar `py-5+` si el contenido es simple
- Avatares o iconos de fila:
  - `size-10` a `size-12`
  - no usar íconos grandes si el resto del sistema es compacto

## Iconografía
- Los iconos son apoyo, no foco.
- Cabeceras de cards:
  - `size-10` a `size-12` para contenedor visual
  - icono interior `h-5 w-5` o `h-6 w-6`
- Evitar iconos gigantes en páginas administrativas o de import/export.

## Vacío visual
- Si hay mucho espacio en blanco sin aportar claridad:
  - reducir ancho del contenedor
  - reducir altura de cards
  - bajar padding
  - compactar títulos, inputs y CTAs
- No “llenar” el vacío con decoración innecesaria.

## Shadcn y composición
- Preferir componentes existentes:
  - `PageHeader`
  - `Card`
  - `Button`
  - `Badge`
  - `Separator`
  - `Table`
  - `Popover`
- Usar variantes del sistema antes de inventar estilos nuevos.

## Checklist antes de cerrar una vista
- ¿Se parece más a `Control del mes`/`Historial` que a una landing?
- ¿La topbar acompaña o compite?
- ¿Los títulos internos están en rango compacto?
- ¿Las cards tienen padding razonable?
- ¿La pantalla podría usar menos ancho útil?
- ¿Hay elementos “grandes” solo por estética?
