# Desarrollo

Guía para quien quiera ejecutar o modificar el proyecto. Lo que muestra la web y de dónde salen los datos está en el [README](../README.md).

## Requisitos

Node 22.18 o superior y pnpm 10.

Si la red sale por un proxy HTTPS, el `fetch` de Node necesita `NODE_USE_ENV_PROXY=1` (Node 22.21 o superior).

## Datos y puntuaciones

```sh
pnpm install
pnpm pipeline                # descarga los datos oficiales, los normaliza y calcula las puntuaciones
pnpm pipeline --offline      # sin descargas: recalcula las puntuaciones desde data/normalized/
pnpm pipeline --offline --date 2026-11-23   # fija la fecha de cálculo
pnpm pipeline --reuse-daily  # reanuda una ejecución: descarga solo los volcados que falten
pnpm sanity                  # controles de sanidad frente a lo publicado ayer (git HEAD)
pnpm discover                # descarga y perfila los ficheros oficiales; informe en .discovery/report.md
```

Las descargas hacen como máximo una petición por segundo. `pnpm discover --days 5` descarga las votaciones de los cinco últimos días con votaciones.

## Web

La web se genera desde `data/derived/` y `config/`:

```sh
pnpm web:dev       # servidor de desarrollo
pnpm web:build     # páginas estáticas en web/dist
pnpm web:audit     # comprueba la compilación: pie, fichas sin JavaScript, peso, enlaces, cabeceras
pnpm web:check     # navegador real: accesibilidad (axe-core), tabla y privacidad; necesita Playwright
pnpm web:preview   # sirve web/dist como Cloudflare Pages, con las cabeceras de producción
```

## Calidad

```sh
pnpm test            # tests unitarios, sobre muestras reales reducidas y datos ficticios marcados como tales
pnpm test:coverage   # los mismos tests, con el umbral de cobertura del 90 %
pnpm typecheck
pnpm lint
pnpm format:check
```

## Publicación

- **Cada día a las 05:40 UTC**, `daily.yml` descarga los datos, los valida, calcula las puntuaciones y pasa los controles de sanidad. Después hace commit de `data/` y despliega en Cloudflare Pages.
- **Ante un fallo** no publica nada y abre la incidencia «Fallo del pipeline diario».
- **En cada push**, `ci.yml` comprueba el código, los datos y la web, y despliega una previsualización de la rama.
- **Secretos:** `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`, en la configuración del repositorio.

## Estructura

```text
config/              configuración: legislatura, URL, umbrales, metodología, grupos y datos del sitio
pipeline/ingest/     cliente HTTP, páginas índice y un adaptador por familia de datos
pipeline/normalize/  esquemas zod, cruce de nombres y construcción de tablas
pipeline/metrics/    motor de puntuación (funciones puras) y salidas para la web
pipeline/sanity/     controles previos a la publicación y resumen del commit diario
pipeline/discover/   script de descubrimiento de los ficheros oficiales
data/                datos en bruto versionados, tablas normalizadas y salidas derivadas
web/                 sitio Astro: páginas, componentes Preact, estilos y scripts de comprobación
tests/               tests y muestras (tests/fixtures)
docs/                documentación
```

## Documentación

| Documento                                                  | Contenido                                                       |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| [decisions.md](decisions.md)                               | Registro de decisiones, con su motivo                           |
| [data-dictionary.md](data-dictionary.md)                   | Ficheros oficiales campo a campo, tablas normalizadas y salidas |
| [fuentes-adicionales.md](fuentes-adicionales.md)           | Otras fuentes públicas evaluadas                                |
| [verificacion-hito-2.md](verificacion-hito-2.md)           | Diez fichas contrastadas con la web del Congreso                |
| [verificacion-metodologia.md](verificacion-metodologia.md) | Comprobaciones de las versiones 1.1.0 y 1.2.0 de la metodología |
| [verificacion-hito-3.md](verificacion-hito-3.md)           | Rendimiento y accesibilidad de la web                           |
| [verificacion-hito-4.md](verificacion-hito-4.md)           | Automatización y despliegue                                     |
