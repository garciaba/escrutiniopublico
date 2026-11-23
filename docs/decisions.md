# Registro de decisiones

Decisiones del agente de código y propuestas que esperan al propietario. Cada entrada indica su estado: **tomada** (aplicada en el código), **propuesta** (el agente recomienda, el propietario decide) o **pendiente** (sin recomendación cerrada). Los hechos citados están documentados en [data-dictionary.md](data-dictionary.md).

| ID    | Tema                                                    | Estado    | Hito afectado |
| ----- | ------------------------------------------------------- | --------- | ------------- |
| D-001 | Ejecutar TypeScript con Node 22 sin paso de compilación | Tomada    | Todos         |
| D-002 | Versiones de herramientas y librerías                   | Tomada    | Todos         |
| D-003 | `User-Agent` frente al cortafuegos del Congreso         | Propuesta | 1, 4          |
| D-004 | Guardar los JSON de votaciones en lugar de los ZIP      | Propuesta | 1             |
| D-005 | Qué legislatura publicar tras la disolución             | Propuesta | 1–3           |
| D-006 | Índice con cobertura del 40 %                           | Pendiente | 2, 3          |
| D-007 | Cómo identificar a los miembros del Gobierno            | Propuesta | 2             |
| D-008 | Identificador de diputado y cruce por nombre            | Tomada    | 1             |
| D-009 | Recuento de intervenciones                              | Propuesta | 1, 2          |
| D-010 | Voto telemático                                         | Propuesta | 1             |
| D-011 | Enlace a la ficha oficial del Congreso                  | Pendiente | 3             |
| D-012 | Exportación de órganos mediante POST                    | Tomada    | 1             |
| D-013 | Intervenciones en la Diputación Permanente              | Pendiente | 2             |
| D-014 | Datos excluidos por la política de datos personales     | Tomada    | 1             |

## D-001 · Ejecutar TypeScript con Node 22 sin paso de compilación

**Tomada (2026-11-23).** Node 22.18 o superior ejecuta ficheros `.ts` eliminando los tipos, sin dependencias extra. Los scripts se lanzan con `node fichero.ts`; `tsc --noEmit` comprueba los tipos y `erasableSyntaxOnly` impide construcciones que Node no sabe ejecutar (enums, namespaces). Evita añadir `tsx` o un paso de build, que la especificación no lista.

## D-002 · Versiones de herramientas y librerías

**Tomada (2026-11-23).** Versiones fijadas con al menos dos semanas de antigüedad. TypeScript 6.0.3 en lugar de 7.x porque `typescript-eslint` 8.72 solo admite TypeScript < 6.1. Del conjunto previsto se usan ya `cheerio` (enlaces de las páginas índice) y `fflate` (ZIP). `fast-xml-parser` y `csv-parse` no hacen falta todavía porque las cinco familias tienen JSON; `zod` entra en el hito 1 con los esquemas.

## D-003 · `User-Agent` frente al cortafuegos del Congreso

**Propuesta.** La especificación pide identificarse con un `User-Agent` que incluya la URL del proyecto y un contacto. El cortafuegos del Congreso responde 403 a varios valores, entre ellos `escano-discovery/0.1 (+https://github.com/garciaba/escrutiniopublico)`, `curl/…` y `Python-urllib/…`. `ESCANO/0.1` es aceptado. No se ha seguido probando variantes para no tantear el cortafuegos.

- **Recomendación:** usar `ESCANO/<versión>` (honesto, sin imitar a un navegador) y escribir al Congreso (datos abiertos) para pedir que acepte un `User-Agent` con URL y contacto.
- Configurable en `config/project.ts` (`http.userAgent`).
- Riesgo: si el cortafuegos endurece el filtro, el pipeline fallará con 403 sin reintentos; el runbook debe cubrirlo.

## D-004 · Guardar los JSON de votaciones en lugar de los ZIP

**Propuesta.** La especificación guarda los ZIP en `data/raw/votaciones/`. Cada ZIP incluye, además del JSON, el XML, un PDF y un PNG por votación: la legislatura entera ocuparía de 200 a 300 MB en git. Los JSON son el 5 % de ese tamaño.

- **Recomendación:** guardar solo los `sesion<n>votacion<m>.json` extraídos, sin modificar, en `data/raw/votaciones/Leg15/Sesion<n>/`, y anotar en `manifest.json` la URL y el SHA-256 del ZIP original. La trazabilidad se mantiene y el repositorio crece unos 15 MB por legislatura.

## D-005 · Qué legislatura publicar tras la disolución

**Propuesta.** La XV Legislatura terminó el 6 de octubre de 2026 y la XVI se constituye el 23 de diciembre. Construir hoy un ranking «en directo» de la XV no tiene sentido, y la XVI no tendrá 90 días de actividad hasta finales de marzo de 2027 como pronto.

- **Recomendación:** que el MVP publique el **balance completo de la XV Legislatura** (datos cerrados y estables) con el aviso de «legislatura finalizada» que ya prevé la especificación, y que el pipeline se prepare para cambiar a la XVI al constituirse.
- Consecuencias que hay que confirmar: los periodos «último mes» y «último trimestre» quedan vacíos para la XV; el control «entre 340 y 350 diputados en activo» debe depender del estado de la legislatura (hoy hay 137 «activos»); la XVI arrancará con métricas casi vacías varios meses.

## D-006 · Índice con cobertura del 40 %

**Pendiente del propietario** (ya listada en la sección 12 de la especificación, ahora confirmada con datos). Solo dos dimensiones tienen dato: dedicación y participación en debates. Opciones:

1. Publicar el índice con cobertura del 40 %, como permite la regla de cobertura mínima.
2. Esperar a tener una tercera dimensión, lo que exige el adaptador del buscador de iniciativas (fase 2, scraping).
3. Estudiar indicadores que sí están en datos abiertos. El agente no los implementa porque la especificación prohíbe improvisar métricas; se dejan como ideas:
   - Preguntas orales formuladas, visibles en intervenciones (`TIPOINICIATIVA` de pregunta, 6.364 filas).
   - Participación como ponente en proyectos y proposiciones de ley (campo `PONENTES`, presente en 46 iniciativas).

## D-007 · Cómo identificar a los miembros del Gobierno

**Propuesta.** Ninguna familia de datos lista al Gobierno. Se puede derivar de `CARGOORADOR` en intervenciones (Presidente del Gobierno, Vicepresidenta…, Ministro/a…) cuando el orador coincide con un diputado del censo. **Recomendación:** derivarlo así como dato `calculado` y fijarlo en una lista manual de `config/overrides.ts` con fecha de nombramiento y enlace al BOE como evidencia, revisada por el propietario.

## D-008 · Identificador de diputado y cruce por nombre

**Tomada.** No hay código oficial (ver diccionario, sección 2). `diputado_id` será un hash estable del nombre normalizado (minúsculas, sin tildes, espacios simples) y la legislatura, como prevé la especificación. El cruce de votos e intervenciones con el censo es por nombre: 99,85 % y 99,93 % de coincidencia exacta. Las variantes (`María del Socorro` / `María`, `Mª Isabel` / `María Isabel`) se resuelven en `config/overrides.ts`, nunca con coincidencia aproximada automática.

## D-009 · Recuento de intervenciones

**Propuesta.** Contar una intervención por `ENLACEDIFERIDO` distinto (el fichero repite la misma intervención por cada iniciativa debatida conjuntamente), descartar las filas `TIPOINTERVENCION = Votación` y asignar solo las filas cuyo orador, sin el sufijo de grupo, está en el censo.

## D-010 · Voto telemático

**Propuesta.** `asiento = -1` aparece en un número fijo de diputados por sesión y casi seguro indica voto telemático, pero no hay documentación oficial. Se guarda como `telematico` con estado `calculado` y no interviene en ninguna puntuación.

## D-011 · Enlace a la ficha oficial del Congreso

**Pendiente.** La especificación pide `url_ficha_oficial`, pero los ficheros no traen el código de diputado que la web usa en sus URL. Opciones: enlazar al buscador de diputados del Congreso, o mantener una tabla manual de códigos (350 entradas por legislatura). Se decide antes del hito 3.

## D-012 · Exportación de órganos mediante POST

**Tomada.** La composición de órganos solo se obtiene con el botón «Exportar datos composición», que hace un POST a un recurso de la web y devuelve un adjunto JSON. Se usa esa misma petición (no se lee HTML). Los parámetros están en `config/project.ts` (`organos`) y en el diccionario, sección 3.5.

## D-013 · Intervenciones en la Diputación Permanente

**Pendiente.** `ORGANO` distingue Pleno, comisiones y Diputación Permanente (517 filas en la XV). La especificación solo define métricas de Pleno y de comisión. Hay que decidir en el hito 2 si la Diputación Permanente cuenta con las comisiones, con el Pleno o queda fuera.

## D-014 · Datos excluidos por la política de datos personales

**Tomada.** No se descargan las declaraciones de intereses económicos (`docacteco`) y no se ingiere el campo `BIOGRAFIA` del censo. En las muestras de `tests/fixtures/` ese campo se sustituye por «[omitido en la muestra]».
