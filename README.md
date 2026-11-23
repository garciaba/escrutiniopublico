# ESCAÑO

Ranking público de la actividad parlamentaria de los diputados del Congreso, construido solo con los [datos abiertos oficiales del Congreso de los Diputados](https://www.congreso.es/es/datos-abiertos). Es un sitio estático regenerado cada día por una tarea programada: sin servidor ni base de datos en producción.

ESCAÑO no tiene vinculación con el Congreso de los Diputados ni con ningún partido político.

## Estado

| Hito                            | Contenido                                                                                                | Estado                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------- |
| 0. Descubrimiento de datos      | [Diccionario de datos](docs/data-dictionary.md), muestras en `tests/fixtures/`, script de descubrimiento | Entregado, pendiente de revisión |
| 1. Ingesta y normalización      | Tablas normalizadas en `data/normalized/`                                                                | Sin empezar                      |
| 2. Métricas y puntuación        | `pipeline/metrics`, `config/scoring.ts`                                                                  | Sin empezar                      |
| 3. Web                          | Sitio Astro                                                                                              | Sin empezar                      |
| 4. Automatización y despliegue  | Workflows diarios y Cloudflare Pages                                                                     | Sin empezar                      |
| 5. Endurecimiento y lanzamiento | Runbook, dominio                                                                                         | Sin empezar                      |

Las decisiones tomadas y las que esperan al propietario están en [docs/decisions.md](docs/decisions.md).

## Uso

Requisitos: Node 22.18 o superior y pnpm 10.

```sh
pnpm install
pnpm test          # tests unitarios sobre muestras reales
pnpm typecheck
pnpm lint
pnpm discover      # descarga y perfila los ficheros oficiales; informe en .discovery/report.md
```

`pnpm discover --days 5` descarga las votaciones de los cinco últimos días con votaciones. El script hace como máximo una petición por segundo.

Si la red sale por un proxy HTTPS, el `fetch` de Node necesita `NODE_USE_ENV_PROXY=1` (Node 22.21 o superior).

## Estructura

```text
config/            configuración: legislatura, URL, umbrales
pipeline/ingest/   cliente HTTP y lectura de las páginas índice
pipeline/discover/ script de descubrimiento del hito 0
tests/             tests y muestras reales reducidas (tests/fixtures)
docs/              diccionario de datos y registro de decisiones
```

## Licencias

Código bajo licencia [MIT](LICENSE). Los datos derivados se publicarán bajo CC BY 4.0. Fuente de los datos: Congreso de los Diputados, citando la fecha de última actualización de cada fichero, según su [aviso legal](https://www.congreso.es/cem/aviso-legal).
