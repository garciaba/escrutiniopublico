# Escrutinio Público

Ranking público de la actividad parlamentaria de los diputados del Congreso, construido solo con los [datos abiertos oficiales del Congreso de los Diputados](https://www.congreso.es/es/datos-abiertos). Es un sitio estático regenerado cada día por una tarea programada: sin servidor ni base de datos en producción.

Escrutinio Público no tiene vinculación con el Congreso de los Diputados ni con ningún partido político.

## Estado

| Hito                            | Contenido                                                                                                | Estado                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 0. Descubrimiento de datos      | [Diccionario de datos](docs/data-dictionary.md), muestras en `tests/fixtures/`, script de descubrimiento | Entregado, pendiente de revisión |
| 1. Ingesta y normalización      | `pnpm pipeline`, tablas normalizadas en `data/normalized/`                                               | Entregado, pendiente de revisión |
| 2. Métricas y puntuación        | `pipeline/metrics`, `config/scoring.ts`, `data/derived/`; [verificación](docs/verificacion-hito-2.md)    | Entregado, pendiente de revisión |
| 3. Web                          | Sitio Astro en `web/` con las seis rutas; [verificación](docs/verificacion-hito-3.md)                    | Entregado, pendiente de revisión |
| 4. Automatización y despliegue  | `daily.yml`, `ci.yml`, Cloudflare Pages ([D-035](docs/decisions.md))                                     | Entregado, pendiente de revisión |
| 5. Endurecimiento y lanzamiento | Runbook, dominio                                                                                         | Sin empezar                      |

Las decisiones tomadas y las que esperan al propietario están en [docs/decisions.md](docs/decisions.md). Las fuentes públicas que podrían ampliar el índice están evaluadas en [docs/fuentes-adicionales.md](docs/fuentes-adicionales.md).

## Uso

Requisitos: Node 22.18 o superior y pnpm 10.

```sh
pnpm install
pnpm test          # tests unitarios sobre muestras reales
pnpm typecheck
pnpm lint
pnpm pipeline      # descarga los datos oficiales y genera las tablas de data/normalized/
pnpm pipeline --offline  # sin descargas: recalcula las puntuaciones desde data/normalized/
pnpm pipeline --offline --date 2026-11-23  # fija la fecha de cálculo
pnpm pipeline --reuse-daily  # reanuda una ejecución: descarga solo los volcados que falten
pnpm discover      # descarga y perfila los ficheros oficiales; informe en .discovery/report.md
```

La web se genera desde `data/derived/` y `config/`:

```sh
pnpm web:dev       # servidor de desarrollo
pnpm web:build     # 418 páginas estáticas en web/dist
pnpm web:audit     # comprueba la compilación: pie, fichas sin JavaScript, peso, enlaces, cabeceras
pnpm web:check     # navegador real: accesibilidad (axe-core), tabla y privacidad; necesita Playwright
pnpm web:preview   # sirve web/dist como Cloudflare Pages, con las cabeceras de producción
```

`pnpm discover --days 5` descarga las votaciones de los cinco últimos días con votaciones. El script hace como máximo una petición por segundo.

Si la red sale por un proxy HTTPS, el `fetch` de Node necesita `NODE_USE_ENV_PROXY=1` (Node 22.21 o superior).

## Publicación

- **Cada día a las 05:40 UTC**, `daily.yml` descarga los datos, los valida, calcula las puntuaciones y pasa los controles de sanidad (`pnpm sanity`). Después hace commit de `data/` y despliega en Cloudflare Pages.
- **Ante un fallo** no publica nada y abre la incidencia «Fallo del pipeline diario».
- **En cada push**, `ci.yml` comprueba el código, los datos y la web, y despliega una previsualización de la rama.
- **Secretos:** `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`, en la configuración del repositorio.

```sh
pnpm sanity          # controles de sanidad frente a lo publicado ayer (git HEAD)
pnpm test:coverage   # tests con el umbral de cobertura del 90 %
```

## Estructura

```text
config/            configuración: legislatura, URL, umbrales, metodología, grupos y datos del sitio
pipeline/ingest/   cliente HTTP, páginas índice y un adaptador por familia de datos
pipeline/normalize/ esquemas zod, cruce de nombres y construcción de tablas
pipeline/metrics/  motor de puntuación (funciones puras) y salidas para la web
data/              datos en bruto versionados, tablas normalizadas y salidas derivadas (ranking y fichas)
pipeline/discover/ script de descubrimiento del hito 0
web/               sitio Astro: páginas, componentes Preact, estilos y scripts de comprobación
tests/             tests y muestras reales reducidas (tests/fixtures)
docs/              diccionario de datos y registro de decisiones
```

## Licencias

Código bajo licencia [MIT](LICENSE). Los datos derivados se publican bajo CC BY 4.0. Fuente de los datos: Congreso de los Diputados, citando la fecha de última actualización de cada fichero, según su [aviso legal](https://www.congreso.es/cem/aviso-legal).
