# Registro de decisiones

Decisiones del agente de código y propuestas que esperan al propietario. Cada entrada indica su estado: **tomada** (aplicada en el código), **decidida** (aprobada por el propietario), **propuesta** (el agente recomienda, el propietario decide) o **pendiente** (sin recomendación cerrada). Los hechos citados están documentados en [data-dictionary.md](data-dictionary.md).

| ID    | Tema                                                             | Estado    | Hito afectado |
| ----- | ---------------------------------------------------------------- | --------- | ------------- |
| D-001 | Ejecutar TypeScript con Node 22 sin paso de compilación          | Tomada    | Todos         |
| D-002 | Versiones de herramientas y librerías                            | Tomada    | Todos         |
| D-003 | `User-Agent` frente al cortafuegos del Congreso                  | Decidida  | 1, 4          |
| D-004 | Guardar los JSON de votaciones en lugar de los ZIP               | Decidida  | 1             |
| D-005 | Qué legislatura publicar tras la disolución                      | Decidida  | 1–3           |
| D-006 | Índice con cobertura del 40 %                                    | Decidida  | 2, 3          |
| D-007 | Cómo identificar a los miembros del Gobierno                     | Decidida  | 2             |
| D-008 | Identificación de los diputados por su nombre                    | Decidida  | 1             |
| D-009 | Recuento de intervenciones                                       | Decidida  | 1, 2          |
| D-010 | Voto telemático                                                  | Decidida  | 1             |
| D-011 | Enlace a la ficha oficial del Congreso                           | Decidida  | 1, 3          |
| D-012 | Exportación de órganos mediante POST                             | Tomada    | 1             |
| D-013 | Intervenciones en la Diputación Permanente                       | Decidida  | 2             |
| D-014 | Datos excluidos por la política de datos personales              | Tomada    | 1             |
| D-015 | Código oficial `codParlamentario` junto al nombre                | Decidida  | 1             |
| D-016 | Tercera dimensión con preguntas y solicitudes de informe         | Decidida  | 1, 2          |
| D-017 | Capturar las agendas antes de la XVI                             | Decidida  | 1             |
| D-018 | Tabla `firmantes` y crédito por iniciativa                       | Tomada    | 1, 2          |
| D-019 | Historial de grupo desde el voto                                 | Tomada    | 1, 2          |
| D-020 | Intervenciones que no cuentan se conservan con su motivo         | Tomada    | 1, 2          |
| D-021 | Volcados diarios no versionados y ejecución `--offline`          | Tomada    | 1, 4          |
| D-022 | Iniciativas que el buscador oficial no puede servir              | Tomada    | 1             |
| D-023 | Población de referencia en periodos cortos                       | Tomada    | 2             |
| D-024 | Miembros del Gobierno: evaluación por etapas                     | Propuesta | 2             |
| D-025 | Fecha de cálculo y periodos tras el cierre de la legislatura     | Tomada    | 2, 4          |
| D-026 | Detalles del cálculo que la especificación no fija               | Tomada    | 2             |
| D-027 | Correcciones de la ingesta detectadas en el contraste del hito 2 | Tomada    | 1, 2          |

## D-001 · Ejecutar TypeScript con Node 22 sin paso de compilación

**Tomada (2026-11-23).** Node 22.18 o superior ejecuta ficheros `.ts` eliminando los tipos, sin dependencias extra. Los scripts se lanzan con `node fichero.ts`; `tsc --noEmit` comprueba los tipos y `erasableSyntaxOnly` impide construcciones que Node no sabe ejecutar (enums, namespaces). Evita añadir `tsx` o un paso de build, que la especificación no lista.

## D-002 · Versiones de herramientas y librerías

**Tomada (2026-11-23).** Versiones fijadas con al menos dos semanas de antigüedad. TypeScript 6.0.3 en lugar de 7.x porque `typescript-eslint` 8.72 solo admite TypeScript < 6.1. Del conjunto previsto se usan ya `cheerio` (enlaces de las páginas índice) y `fflate` (ZIP). `fast-xml-parser` y `csv-parse` no hacen falta todavía porque las cinco familias tienen JSON; `zod` entra en el hito 1 con los esquemas.

## D-003 · `User-Agent` frente al cortafuegos del Congreso

**Decidida por el propietario (2026-11-23): se usa `ESCANO/<versión>`.** La especificación pedía identificarse con un `User-Agent` que incluya la URL del proyecto y un contacto. El cortafuegos del Congreso responde 403 a varios valores, entre ellos `escano-discovery/0.1 (+https://github.com/garciaba/escrutiniopublico)`, `curl/…` y `Python-urllib/…`. `ESCANO/0.1` es aceptado. No se ha seguido probando variantes para no tantear el cortafuegos.

- **Decisión:** `ESCANO/<versión>`, honesto y sin imitar a un navegador. Queda como mejora opcional escribir al Congreso (datos abiertos) para pedir que acepte un `User-Agent` con URL y contacto.
- Configurable en `config/project.ts` (`http.userAgent`).
- Riesgo: si el cortafuegos endurece el filtro, el pipeline fallará con 403 sin reintentos; el runbook debe cubrirlo.

## D-004 · Guardar los JSON de votaciones en lugar de los ZIP

**Decidida por el propietario (2026-11-23).** La especificación guardaba los ZIP en `data/raw/votaciones/`. Cada ZIP incluye, además del JSON, el XML, un PDF y un PNG por votación: la legislatura entera ocuparía de 200 a 300 MB en git. Los JSON son el 5 % de ese tamaño.

- **Decisión:** guardar solo los `sesion<n>votacion<m>.json` extraídos, sin modificar, en `data/raw/votaciones/Leg15/Sesion<n>/`, y anotar en `manifest.json` la URL y el SHA-256 del ZIP original. La trazabilidad se mantiene y el repositorio crece unos 15 MB por legislatura.

## D-005 · Qué legislatura publicar tras la disolución

**Decidida por el propietario (2026-11-23), según la recomendación del agente.** La XV Legislatura terminó el 6 de octubre de 2026 y la XVI se constituye el 23 de diciembre. Construir hoy un ranking «en directo» de la XV no tiene sentido, y la XVI no tendrá 90 días de actividad hasta finales de marzo de 2027 como pronto.

- **Objetivo del propietario (ampliado el 2026-11-23):** publicar la información de los diputados actuales y, cuando empiece la XVI, seguir su trabajo en tiempo real.
- **Decisión:** el MVP publica el **balance completo de la XV Legislatura** (datos cerrados y estables) con el aviso de «legislatura finalizada» que ya prevé la especificación, y el pipeline se prepara para cambiar a la XVI al constituirse.
- Consecuencias para los hitos 1 a 3: los periodos «último mes» y «último trimestre» quedan como «no disponible» para la XV; el control «entre 340 y 350 diputados en activo» depende del estado de la legislatura (hoy hay 137 «activos»); la XVI arrancará con métricas casi vacías varios meses.

## D-006 · Índice con cobertura del 40 %

**Decidida por el propietario (2026-11-23): se publica el índice global con cobertura del 40 %**, como permite la regla de cobertura mínima. Solo dos dimensiones tienen dato: dedicación y participación en debates. La cobertura se muestra siempre junto al índice («calculado con 2 de 5 dimensiones»).

Opciones descartadas por ahora:

1. Esperar a tener una tercera dimensión, lo que exige el adaptador del buscador de iniciativas (fase 2, scraping).
2. Indicadores que sí están en datos abiertos, que el agente no implementa porque la especificación prohíbe improvisar métricas. Quedan como ideas para una futura versión de la metodología:
   - Preguntas orales formuladas, visibles en intervenciones (`TIPOINICIATIVA` de pregunta, 6.364 filas).
   - Participación como ponente en proyectos y proposiciones de ley (campo `PONENTES`, presente en 46 iniciativas).

## D-007 · Cómo identificar a los miembros del Gobierno

**Decidida por el propietario (2026-11-23): identificarlos por su nombre, con un cruce correcto.** Ninguna familia de datos del Congreso lista al Gobierno, y el cargo que trae el fichero de intervenciones no es fiable. Por ejemplo, atribuye «Ministro de Hacienda» a un diputado raso y cargos ministeriales a personas que nunca lo fueron. La fuente es el BOE:

- Se recorrieron los sumarios diarios del BOE del 13/01/2020 al 06/10/2026 (API de datos abiertos, sin huecos) y se reconstruyeron, decreto a decreto, los periodos de cada presidente, vicepresidente y ministro, incluido el Gobierno en funciones del 17/08 al 20/11/2023.
- Los nombres del BOE («Nombre Apellidos») se cruzaron con el censo con las reglas estrictas de D-008 y cada par se revisó a mano.
- Resultado: **18 diputados de la XV fueron miembros del Gobierno durante su mandato**, listados en `governmentMembers` de `config/overrides.ts` con sus fechas y las referencias del BOE. Cinco de ellos lo fueron solo en funciones: Belarra, Miñones, Héctor Gómez, Iceta y Raquel Sánchez. Óscar López y Milagros Tolón no aparecen porque sus etapas de diputado y de ministro no coinciden.
- El pipeline cruzará esos periodos con el mandato de cada diputado para aplicar la regla de la sección 7 de la especificación.

## D-008 · Identificación de los diputados por su nombre

**Decidida por el propietario (2026-11-23): es obligatorio que cada diputado quede identificado por su nombre, con un cruce correcto entre todas las fuentes.**

- La web muestra siempre el nombre completo tal como figura en el censo del Congreso. `diputado_id` (hash estable del nombre normalizado y la legislatura) es solo una clave interna para ficheros y URL; nunca sustituye al nombre.
- Cruce estricto: un registro se asigna a un diputado si su nombre coincide exactamente con el censo o con un alias revisado a mano en `config/overrides.ts`. No hay coincidencia aproximada automática (`pipeline/normalize/names.ts`).
- Resultado sobre la XV completa: 100 % de los votos, intervenciones y pertenencias de diputados identificados, con 6 alias (diccionario, sección 4).
- En el hito 1, un nombre nuevo sin cruzar que lleve grupo del Congreso, o con cargo «Diputado/a», no se descarta en silencio: se lista en el registro del pipeline y abre una incidencia para añadir el alias. El umbral de 0,5 % sin asignar de la especificación queda solo como red de seguridad.

## D-009 · Recuento de intervenciones

**Decidida por el propietario (2026-11-23), según la recomendación del agente.** Se cuenta una intervención por `ENLACEDIFERIDO` distinto (el fichero repite la misma intervención por cada iniciativa debatida conjuntamente) y se descartan las filas `TIPOINTERVENCION = Votación` y las de la Diputación Permanente (D-013).

Precisión añadida tras el cruce completo (diccionario, sección 4), necesaria para asignar solo a diputados: la intervención cuenta si el orador, tras quitar el sufijo de grupo y aplicar los alias, es un diputado del censo **en activo en esa fecha** y habla **como diputado o con un cargo parlamentario** (presidencia o secretaría de comisión, Mesa, candidato en una investidura). No cuentan las que hace como miembro del Gobierno, secretario de Estado u otro cargo externo, ni las posteriores a su baja.

## D-010 · Voto telemático

**Decidida por el propietario (2026-11-23), según la recomendación del agente.** `asiento = -1` aparece en un número fijo de diputados por sesión y casi seguro indica voto telemático, pero no hay documentación oficial. Se guarda como `telematico` con estado `calculado` y no interviene en ninguna puntuación.

## D-011 · Enlace a la ficha oficial del Congreso

**Decidida por el propietario (2026-11-23), con D-015.** Cada ficha de ESCAÑO enlaza a la ficha oficial: `https://www.congreso.es/es/busqueda-de-diputados?p_p_id=diputadomodule&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_diputadomodule_mostrarFicha=true&codParlamentario={código}&idLegislatura=XV`.

## D-012 · Exportación de órganos mediante POST

**Tomada.** La composición de órganos solo se obtiene con el botón «Exportar datos composición», que hace un POST a un recurso de la web y devuelve un adjunto JSON. Se usa esa misma petición (no se lee HTML). Los parámetros están en `config/project.ts` (`organos`) y en el diccionario, sección 3.5.

## D-013 · Intervenciones en la Diputación Permanente

**Decidida por el propietario (2026-11-23): la Diputación Permanente queda fuera.** ESCAÑO mide la actividad en periodos ordinarios. Las intervenciones con `ORGANO = Diputación Permanente` (517 filas en la XV, 79 de ellas tras la disolución) no cuentan en ninguna métrica, y sus votaciones tampoco se ingieren. La pertenencia a la Diputación Permanente puede mostrarse en la ficha como cargo, sin efecto en la puntuación.

## D-014 · Datos excluidos por la política de datos personales

**Tomada.** No se descargan las declaraciones de intereses económicos (`docacteco`) y no se ingiere el campo `BIOGRAFIA` del censo. En las muestras de `tests/fixtures/` ese campo se sustituye por «[omitido en la muestra]».

## D-015 · Código oficial `codParlamentario` junto al nombre

**Decidida por el propietario (2026-11-23), según la recomendación del agente.** En el hito 1 se ingiere el recurso `searchDiputados` del buscador de diputados (una petición por legislatura) y la tabla `diputados` guarda el par (legislatura, `codParlamentario`) junto al nombre.

- Comprobado el 23/11/2026: 412 códigos distintos, y los 412 nombres coinciden exactamente con el censo de datos abiertos ([fuentes-adicionales.md](fuentes-adicionales.md), sección 2.3).
- Usos: enlace a la ficha oficial (D-011), comprobación independiente del cruce por nombre (el pipeline falla si un nombre del censo no tiene código o al revés) y clave para las fuentes de D-016 y D-017.
- El nombre sigue siendo la identificación visible (D-008). El código cambia entre legislaturas.
- Si el recurso deja de responder, el cruce por nombre sigue funcionando y solo se pierden el enlace y la comprobación.

## D-016 · Tercera dimensión con preguntas y solicitudes de informe

**Decidida por el propietario (2026-11-23): se añade la tercera dimensión.** La cobertura pasa del 40 % al 60 % (3 de 5 dimensiones). La forma de medirla es una propuesta del agente, que entra en la metodología con el hito 2 y sube su versión:

| Elemento         | Propuesta                                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dimensión        | La tercera de la especificación, renombrada «Iniciativa parlamentaria» porque deja de medir solo leyes. Peso 20, sin cambios.                                                     |
| Métricas         | Preguntas con respuesta escrita (tipo 184) y solicitudes de informe (tipo 186) por cada 100 días en activo. «Iniciativas legislativas firmadas» se mantiene como `no_disponible`. |
| Cofirmas         | Crédito fraccional: una iniciativa con n firmantes suma 1/n a cada uno. La ficha muestra también el total firmado y el número como primer firmante.                               |
| Preguntas orales | No se suman aquí: se formulan en el Pleno o en comisión y ya cuentan como intervenciones.                                                                                         |
| Estado           | `calculado`, porque el crédito fraccional es un indicador derivado.                                                                                                               |
| Fuente           | Exportación del buscador de iniciativas (firmantes por expediente), cruzada por nombre con las reglas de D-008.                                                                   |
| Comprobación     | Para cada diputado, los expedientes en los que figura deben coincidir con el total del cuadro estadístico de su ficha (`datosCuadroEstadistico`).                                 |

El adaptador entra en el hito 1, adelantando lo que la especificación dejaba para la fase 2.

## D-017 · Capturar las agendas antes de la XVI

**Decidida por el propietario (2026-11-23): se capturan.** La idea del propietario es publicar la información de los diputados actuales y, cuando empiece la XVI, seguir su trabajo en tiempo real. La agenda solo es accesible mientras el diputado está en activo: ya no responde para quienes causaron baja el 06/10/2026, y puede desaparecer para todos cuando se constituya la XVI el 23/12/2026.

- Se capturan las agendas de los 137 diputados que siguen en activo, una petición por semana y diputado, a una petición por segundo.
- **Privacidad:** el repositorio guarda, por cita, la fecha, las horas y el tipo. En las institucionales guarda además el órgano; en las personales, nunca el texto, que puede nombrar a terceros. La web publicará solo recuentos (si publica agenda personal y cuántas citas declara).
- Captura: workflow [`agendas.yml`](../.github/workflows/agendas.yml), todas las semanas desde el 17/08/2023 para los 137 diputados en activo (unas 23.600 peticiones), en tres tramos secuenciales de GitHub Actions. Cada tramo guarda su avance en `data/raw/agendas/XV/` y el siguiente continúa.
- En la XVI la agenda pasa a ser una fuente diaria del pipeline.

## D-018 · Tabla `firmantes` y crédito por iniciativa

**Tomada (hito 1).** El modelo de la especificación guarda los autores de una iniciativa como texto. Para medir la tercera dimensión (D-016) se añade la tabla `firmantes`: una fila por diputado firmante, con su posición en la autoría (`orden`) y el número total de firmantes (`n_firmantes`). Así el crédito fraccional, el primer firmante y el total firmado salen de la misma tabla. Solo se llena para preguntas escritas, solicitudes de informe y proposiciones de ley «de Diputados»; las de grupo, Gobierno, Senado o comunidades autónomas guardan el autor como texto.

## D-019 · Historial de grupo desde el voto

**Tomada (hito 1).** El censo solo guarda el último grupo de cada diputado. Cada voto trae el código de grupo vigente ese día, así que `votos.grupo_id` conserva el historial (por ejemplo, diputados que pasaron de VOX al Mixto). El percentil por grupo del hito 2 usará el grupo de cada momento, no solo el último.

## D-020 · Intervenciones que no cuentan se conservan con su motivo

**Tomada (hito 1).** La tabla `intervenciones` guarda todas las intervenciones de personas del censo, también las que no cuentan como actividad de diputado. Las columnas `cuenta` y `motivo_exclusion` (`fuera_de_mandato`, `diputacion_permanente`, `cargo_gobierno`, `cargo_externo`) aplican D-009 y D-013. El cálculo del hito 2 filtra por `cuenta`, y la exclusión queda auditable en los datos publicados.

## D-021 · Volcados diarios no versionados y ejecución `--offline`

**Tomada (hito 1).** Los volcados diarios (`data/raw/daily/`) no se versionan, como dice la especificación: el de intervenciones ocupa 57 MB y el buscador de iniciativas, unos 30 MB. Se versionan los JSON de votaciones (D-004), el manifiesto y las tablas normalizadas. `pnpm pipeline --offline` rehace la normalización desde `data/raw/` si existen los volcados del día. En un clon limpio, la reproducibilidad del cálculo (hito 2) parte de `data/normalized/`, que sí está versionado.

## D-022 · Iniciativas que el buscador oficial no puede servir

**Tomada (hito 1).** La exportación del buscador de iniciativas sirve bloques de 100, ordenados por fecha de calificación. El 23/11/2026, el bloque 154 de preguntas escritas devolvía vacío en JSON, XML y CSV. El listado paginado (25 por página) responde `{"error": "Error en la consulta"}` en cualquier página donde cae un registro concreto: una pregunta del Grupo Popular registrada el 13/10/2025, calificada el 21/10/2025 y firmada por 14 diputados.

- **Recuperación automática:** se consultan en el listado los días de calificación que cubre el bloque fallido, deducidos de sus vecinos. Si una página falla, la consulta se trocea por grupo y, si hace falta, por diputado. Así se recuperan los registros que comparten página con el roto en unas consultas pero no en otras.
- **Lo que no se puede servir** se registra en `data/raw/iniciativas-incidencias.json`: total oficial, registros obtenidos, faltantes, bloques fallidos y consultas que siguieron fallando. Ese fichero está versionado y se publicará en `/cambios`.
- **Umbral:** hasta `maxUnavailable` (50) registros por tipo, la ejecución sigue y lo deja documentado. Por encima, se detiene. Si el Congreso corrige el registro, la ejecución siguiente lo recupera sin cambios en el código.
- **Efecto en la métrica:** las preguntas que falten quedan fuera del crédito de sus firmantes. El hito 2 contrastará los totales por diputado con el cuadro estadístico de su ficha (D-016) y mostrará la diferencia.

## D-023 · Población de referencia en periodos cortos

**Tomada (hito 2).** La especificación exige 90 días en activo dentro del periodo para entrar en la población de referencia. Aplicado tal cual, «último mes» (30 días) y «último trimestre» (91 días) no tendrían nunca ranking. Se mantienen los 90 días para la legislatura y el último año, y en los periodos de menos de 180 días el mínimo es la mitad del periodo: 46 días en el trimestre y 15 en el mes. Los dos valores están en `config/scoring.ts` (`poblacionReferencia`).

## D-024 · Miembros del Gobierno: evaluación por etapas

**Propuesta, aplicada en el cálculo.** La especificación excluye del ranking general a los miembros del Gobierno, pero no dice qué hacer con quien lo fue solo una parte del periodo. En la XV hay casos en los dos extremos: Ione Belarra fue ministra en funciones 96 días y diputada sin cargo casi tres años; Óscar Puente fue diputado sin cargo 96 días y ministro casi tres años.

- Los días en el Gobierno no se evalúan: no cuentan como días en activo, ni cuentan las votaciones, intervenciones o iniciativas de esas fechas.
- Entra en el ranking quien reúne los días mínimos fuera del Gobierno (D-023) y no ha pasado en él más días que fuera. Se le evalúa solo por esa etapa y la ficha lo indica.
- Los demás quedan fuera del ranking general, con sus métricas brutas de todo el periodo. Para que el filtro de la web pueda incluirlos, se calcula su percentil frente a la población de referencia, sin posición.
- Resultado en la XV: 16 diputados fuera del ranking por Gobierno; Belarra y Miñones, en el ranking por su etapa posterior.
- Alternativa descartada: excluir a cualquiera que haya sido miembro del Gobierno algún día del periodo. Dejaría fuera a Belarra por tres meses en funciones.

## D-025 · Fecha de cálculo y periodos tras el cierre de la legislatura

**Tomada (hito 2), siguiendo D-005.** La fecha de cálculo es la del día de la ejecución (`pnpm pipeline --date` permite fijar otra) y es el único dato de reloj: entra como parámetro a las funciones de métricas. Cada periodo se recorta a la legislatura.

- Con la XV cerrada el 06/10/2026 y fecha de cálculo 23/11/2026: «Legislatura» abarca del 17/08/2023 al 06/10/2026; «Último año», del 24/11/2025 al 06/10/2026; «Último trimestre» y «Último mes» quedan como «no disponible», como preveía D-005.
- Consecuencia: mientras la XV sea la legislatura publicada, el «último año» se acorta un día cada día y las salidas cambian a diario aunque no haya datos nuevos.
- Alternativa, de un cambio pequeño: en una legislatura cerrada, anclar los periodos a su último día («último año de la legislatura»), lo que daría cuatro periodos estables. Queda a criterio del propietario.

## D-026 · Detalles del cálculo que la especificación no fija

**Tomada (hito 2).**

| Detalle                                                     | Regla aplicada                                                                                                                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Días en activo                                              | Del alta a la baja, ambos incluidos, dentro del periodo                                                                                                                          |
| Denominador de votaciones                                   | Votaciones nominales en cuya lista oficial figura el diputado (D-008); no se deduce de las fechas                                                                                |
| Intervenciones en sesión conjunta de las dos Cámaras        | No cuentan ni como Pleno ni como comisión (2 en la XV)                                                                                                                           |
| Grupo del diputado en un periodo                            | El que consta en su última votación del periodo (D-019); si no votó, el del censo                                                                                                |
| Percentil de quien está fuera de la población de referencia | Misma fórmula, contra los valores de la población de referencia                                                                                                                  |
| Métrica sin oportunidad para un diputado                    | Si no figura en ninguna votación del periodo, esa métrica es «no disponible» para él y su cobertura baja                                                                         |
| Periodo sin ninguna métrica con actividad                   | El periodo entero es «no disponible»                                                                                                                                             |
| Redondeo                                                    | Índice y dimensiones, a 1 decimal; las posiciones se asignan sobre el índice redondeado                                                                                          |
| Etiquetas de rol                                            | `presidencia` y `mesa` por pertenencia a la Mesa; `portavoz` por ser portavoz titular en la Junta de Portavoces; `gobierno` según el BOE (D-007). Con fechas, dentro del periodo |

## D-027 · Correcciones de la ingesta detectadas en el contraste del hito 2

**Tomada (hito 2).** El contraste de diez fichas con la web del Congreso ([verificacion-hito-2.md](verificacion-hito-2.md)) destapó tres defectos del hito 1, corregidos en este:

- **Solicitudes de informe:** D-016 hablaba del tipo 186, pero la ficha oficial suma cuatro tipos. Se ingieren también el 187 (comunidades autónomas), el 188 (entidades locales) y el 189 (otras entidades públicas): 577 solicitudes más. La métrica los suma todos.
- **Preguntas escritas:** la ficha oficial suma con las preguntas al Gobierno (tipo 184) las dirigidas a la Corporación RTVE (tipo 179). Se ingieren también: 2.569 preguntas más. La métrica «Preguntas con respuesta escrita» suma los dos tipos.
- **Firmantes sin código de grupo:** la exportación del buscador escribe a veces un firmante sin su código, solo o pegado al nombre siguiente. Se perdían en silencio 51 firmas de 29 preguntas. El análisis de autores los reconoce ahora contra el censo, y los autores que no son diputados (senadores, grupos) se listan en el registro de la ejecución.
- Nueva opción `pnpm pipeline --reuse-daily`: reutiliza los volcados ya descargados y baja solo los que faltan, para reanudar una ejecución sin repetir las descargas.
