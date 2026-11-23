# Diccionario de datos — Hito 0

Descubrimiento hecho el 23 de noviembre de 2026 sobre el [portal de datos abiertos del Congreso](https://www.congreso.es/es/datos-abiertos). Se reproduce con `pnpm discover` (ver [README](../README.md)); las muestras reales reducidas de cada fichero están en [`tests/fixtures/congreso/`](../tests/fixtures/congreso/).

**Conclusión:** con los datos abiertos actuales, ESCAÑO puede medir con dato oficial directo dos de las cinco dimensiones (dedicación y participación en debates). Productividad legislativa y resultados no son atribuibles a diputados concretos. Cobertura máxima del índice: 40 %.

## 1. Contexto que condiciona todo el proyecto

- **Las Cortes están disueltas.** El [Real Decreto 806/2026, de 5 de octubre](https://www.congreso.es/es/disolucion), disolvió el Congreso con efecto del 6 de octubre de 2026. Las elecciones son el 29 de noviembre y la sesión constitutiva de la XVI Legislatura, el 23 de diciembre de 2026.
- La XV Legislatura está cerrada: la última votación de Pleno publicada es del 2 de octubre de 2026. Desde la disolución solo hay actividad de la Diputación Permanente (79 intervenciones hasta el 12 de noviembre).
- `DiputadosActivos` tiene hoy **137 filas**, no 350: solo siguen «en activo» los miembros de la Diputación Permanente y sus suplentes. El control de sanidad «entre 340 y 350 diputados en activo» fallaría todos los días hasta enero.
- En la XV Legislatura ha habido **412 personas** con escaño: 350 iniciales más 62 sustituciones antes de la disolución. 213 bajas llevan fecha 06/10/2026.

## 2. Respuestas a las cinco preguntas pendientes (sección 3 de la especificación)

| Familia        | Pregunta                                         | Respuesta                                                                                                                                                                         | Consecuencia                                                                                                                                                                                          |
| -------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Diputados      | ¿Identificador estable por diputado?             | **No.** Ningún fichero trae un código. La clave es el nombre en formato «Apellidos, Nombre».                                                                                      | `diputado_id` = hash estable de nombre normalizado y legislatura, con tabla manual de correcciones (ya prevista en la especificación). Sin código no se puede construir el enlace a la ficha oficial. |
| Votaciones     | ¿El ZIP trae voto nominal y en qué formato?      | **Sí**, salvo en votaciones secretas y por llamamiento. Un JSON y un XML por votación, con una fila por diputado: asiento, nombre, grupo y voto.                                  | La dimensión «Dedicación» es viable con dato observado.                                                                                                                                               |
| Intervenciones | ¿Distingue Pleno y comisión? ¿Orador y duración? | **Sí.** `ORGANO` distingue Pleno, cada comisión y la Diputación Permanente. `ORADOR` trae nombre y grupo. Hora de inicio y fin al minuto.                                         | «Intervenciones en Pleno» e «Intervenciones en comisión» son viables. La duración es aproximada (resolución de un minuto).                                                                            |
| Iniciativas    | ¿El autor es un diputado o solo el grupo?        | **Casi siempre el grupo.** De 371 proposiciones de ley, solo 2 son «de Diputados», y una de ellas lista a un único firmante «y 45 Diputados». Las leyes aprobadas no traen autor. | «Productividad legislativa» y «Resultados e impacto» no son atribuibles a personas: estado `no_disponible`.                                                                                           |
| Órganos        | ¿Formato y URL de la exportación?                | **JSON, CSV o XML** mediante una petición POST al botón «Exportar datos composición». No hay fichero estático con URL fija.                                                       | Viable. Ver sección 3.5 para los parámetros.                                                                                                                                                          |

## 3. Ficheros, campo a campo

Formato común: las fechas son `dd/mm/aaaa`; los campos vacíos **no aparecen** en el JSON (en CSV y XML sí, vacíos). Los CSV son UTF-8 con BOM, separados por `;` y con saltos CRLF. Muchos textos largos contienen saltos de línea internos y espacios dobles que hay que normalizar.

### 3.1 Diputados

Página índice: [opendata/diputados](https://www.congreso.es/es/opendata/diputados). Cada fichero se publica en CSV, JSON y XML con nombre `<Prefijo>__<aaaammddhhmmss>.<ext>`; la marca de tiempo cambia a diario (hacia las 05:00 hora peninsular).

| Prefijo               | Contenido                                                                           | Filas (23/11/2026) | Uso                                         |
| --------------------- | ----------------------------------------------------------------------------------- | ------------------ | ------------------------------------------- |
| `DiputadosActivos`    | Diputados en activo                                                                 | 137                | Censo                                       |
| `DiputadosDeBaja`     | Bajas de la legislatura actual                                                      | 275                | Censo                                       |
| `docacteco`           | Declaraciones de intereses económicos                                               | —                  | **Excluido** (política de datos personales) |
| `Diput`               | Todos los diputados de todas las legislaturas (sin fechas de la legislatura actual) | 6.325              | No se usa en el MVP                         |
| `Diputadas`           | Subconjunto de `Diput`                                                              | —                  | No se usa                                   |
| `odsDiputados00`…`14` | Un fichero por legislatura anterior (Constituyente a XIV)                           | —                  | Fase 2 (histórico)                          |

Campos de `DiputadosActivos` y `DiputadosDeBaja`:

| Campo                           | Formato             | Rellenado      | Ejemplo                 | Destino en ESCAÑO                                                                        |
| ------------------------------- | ------------------- | -------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| `NOMBRE`                        | «Apellidos, Nombre» | 100 %          | Abascal Conde, Santiago | `diputados.nombre`, `apellidos`, `slug`, `diputado_id`                                   |
| `CIRCUNSCRIPCION`               | texto               | 100 %          | Madrid                  | `diputados.circunscripcion` (52 valores, con nombres bilingües como «Valencia/València») |
| `FORMACIONELECTORAL`            | siglas              | 100 %          | PSC-PSOE                | `diputados.partido` (16 valores: hay que agrupar federaciones, ver `config/parties.ts`)  |
| `FECHACONDICIONPLENA`           | fecha               | 100 %          | 17/08/2023              | Inicio de la condición plena de diputado                                                 |
| `FECHAALTA`                     | fecha               | 100 %          | 16/08/2023              | `diputados.fecha_alta`                                                                   |
| `FECHABAJA`                     | fecha               | 100 % en bajas | 06/10/2026              | `diputados.fecha_baja`                                                                   |
| `GRUPOPARLAMENTARIO`            | nombre completo     | 100 %          | Grupo Parlamentario VOX | `grupos.nombre` (9 grupos)                                                               |
| `FECHAALTAENGRUPOPARLAMENTARIO` | fecha               | 100 %          | 18/08/2023              | Alta en el grupo actual                                                                  |
| `FECHABAJAENGRUPOPARLAMENTARIO` | fecha               | 100 % en bajas | 06/10/2026              | Baja en el grupo                                                                         |
| `BIOGRAFIA`                     | texto libre         | 99 %           | —                       | **No se ingiere** (datos personales sin relación con la actividad)                       |

Limitaciones: cada fila refleja solo el **último** grupo de la persona; los cambios de grupo a mitad de legislatura no tienen histórico en este fichero. Los nombres son únicos dentro de la XV Legislatura (412 personas, ningún duplicado).

### 3.2 Votaciones

Página índice: [opendata/votaciones](https://www.congreso.es/es/opendata/votaciones). La portada muestra solo la última sesión. Para el resto:

1. La página índice incluye en un script el calendario de la legislatura: `var diasVotaciones = [20230919, …, 20261002]` (147 días en la XV).
2. La página de cada día (`?p_p_id=votaciones&…&targetLegislatura=XV&targetDate=dd/mm/aaaa`) enlaza un ZIP por sesión. Un mismo día puede tener dos sesiones (ej. 26/03/2026, sesiones 169 y 170).
3. Ruta del ZIP: `/webpublica/opendata/votaciones/Leg15/Sesion<n>/<aaaammdd>/VOT_<aaaammddhhmmss>.zip`. La hora del nombre no es deducible: hay que leer el enlace.

Contenido del ZIP: por cada votación, `sesion<n>votacion<m>.json`, `.xml` (ISO-8859-1), `.pdf` y `.png` (gráfico de tarta). En una muestra de 16 sesiones repartidas por la legislatura hubo 192 votaciones.

| Campo JSON                                              | Formato                             | Ejemplo                          | Destino                                |
| ------------------------------------------------------- | ----------------------------------- | -------------------------------- | -------------------------------------- |
| `informacion.sesion`                                    | entero                              | 202                              | `votaciones.sesion`                    |
| `informacion.numeroVotacion`                            | entero                              | 1                                | parte de `votacion_id`                 |
| `informacion.fecha`                                     | `d/m/aaaa` **sin ceros**            | 30/9/2026                        | `votaciones.fecha`                     |
| `informacion.titulo`                                    | texto                               | Proposiciones no de Ley.         | `votaciones.titulo`                    |
| `informacion.textoExpediente`                           | texto                               | Proposición no de Ley del Grupo… | `votaciones.titulo` (detalle)          |
| `informacion.tituloSubGrupo`, `textoSubGrupo`           | texto                               | —                                | Detalle (enmiendas, puntos)            |
| `informacion.votacionesConjuntas[]`                     | lista de `{textoExpediente}`        | —                                | Iniciativas votadas a la vez           |
| `totales.asentimiento`                                  | Sí/No                               | No                               | Votación por asentimiento              |
| `totales.presentes`                                     | entero                              | 346                              | = a favor + en contra + abstenciones   |
| `totales.afavor`, `enContra`, `abstenciones`, `noVotan` | enteros                             | 137, 175, 34, 4                  | `votaciones.totales`                   |
| `votaciones[].asiento`                                  | texto numérico o `-1`               | 2404                             | `votos.telematico` (ver abajo)         |
| `votaciones[].diputado`                                 | «Apellidos, Nombre»                 | Badia Casas, Eloi                | `votos.diputado_id` (cruce por nombre) |
| `votaciones[].grupo`                                    | código                              | GSUMAR                           | Contexto; no se usa para el cruce      |
| `votaciones[].voto`                                     | `Sí`, `No`, `Abstención`, `No vota` | No                               | `votos.sentido`                        |

Hechos comprobados:

- Cada votación nominal lista a **los 350 escaños**. Quien no vota aparece como `No vota`; no hay forma de distinguir ausencia de no participación.
- `asiento = -1` aparece en un número fijo de diputados por sesión (9 a 31). Es muy probablemente el **voto telemático**, pero ningún documento oficial lo confirma: se marca como `calculado`, no como `observado`.
- **Votaciones secretas** (ej. dictámenes de la Comisión del Estatuto de los Diputados): JSON con totales y `votaciones: []`.
- **Votaciones públicas por llamamiento** (ej. sesión 203, 02/10/2026): el ZIP solo trae los PNG; no hay voto nominal.
- Los totales cuadran con las filas en las 190 votaciones nominales de la muestra.
- Los códigos de grupo de este fichero (`GP`, `GS`, `GVOX`, `GSUMAR`, `GMx`, `GR`, `GJxCAT`, `GEH Bildu`, `GV (EAJ-PNV)`) difieren de los nombres completos del censo: hace falta una tabla de correspondencia en `config/parties.ts`. Dos filas de la muestra tienen grupo vacío.

Volumen: en la muestra, un ZIP pesa entre 0,02 y 8,1 MB (1,5 MB de media); con unas 150 sesiones con votaciones, la legislatura completa ocupa del orden de 200 a 300 MB. Los JSON son el 5 % de ese tamaño comprimido (1,3 MB frente a 23,9 MB en la muestra). Ver decisión D-004 en [decisions.md](decisions.md).

### 3.3 Intervenciones

Página índice: [opendata/intervenciones](https://www.congreso.es/es/opendata/intervenciones). Dos prefijos, `IntervencionesCronologicamente` e `IntervencionesIniciativa`, con **las mismas filas** en distinto orden (comprobado). Se usa el cronológico. JSON de 57 MB, 43.042 filas, del 17/08/2023 al 12/11/2026.

| Campo                                   | Rellenado | Ejemplo                                                                                             | Destino                                                          |
| --------------------------------------- | --------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `LEGISLATURA`                           | 100 %     | Leg.15                                                                                              | Filtro                                                           |
| `SESION`                                | 100 %     | 19/09/2023                                                                                          | `intervenciones.fecha` (es una fecha, no un número de sesión)    |
| `ORGANO`                                | 100 %     | Pleno · Comisión de Sanidad · Diputación Permanente · (152/5) Comisión Investigación sobre la DANA… | `intervenciones.organo_id` (46 valores)                          |
| `TIPOINTERVENCION`                      | 100 %     | `Intervención` o `Votación`                                                                         | Las 1.676 filas `Votación` no tienen orador y se descartan       |
| `FASE`                                  | 96 %      | Debate · Pregunta-contestación                                                                      | Contexto                                                         |
| `ORADOR`                                | 96 %      | Pueyo Sanz, Jorge (GSUMAR)                                                                          | `intervenciones.diputado_id` tras quitar el sufijo de grupo      |
| `CARGOORADOR`                           | 96 %      | Diputado · Ministro del Interior · Senadora                                                         | Filtro y detección de miembros del Gobierno                      |
| `INICIOINTERVENCION`, `FININTERVENCION` | 99 %      | 14:09 · 14:10                                                                                       | Duración al minuto (1.982 filas duran 0 minutos)                 |
| `ENLACEDIFERIDO`                        | 100 %     | https://app.congreso.es/v1/1525087I                                                                 | `intervencion_id` (puede traer 2 o 3 URL separadas por espacios) |
| `ENLACEDESCARGADIRECTA`                 | 100 %     | enlace al vídeo                                                                                     | `url_fuente` alternativa                                         |
| `ENLACETEXTOINTEGRO`, `ENLACEPDF`       | 100 %     | Diario de Sesiones                                                                                  | `intervenciones.url_fuente`                                      |
| `SUPERTIPOINICIATIVA`                   | 99 %      | Función de control                                                                                  | Contexto (texto duplicado con salto de línea)                    |
| `TIPOINICIATIVA`                        | 99 %      | Pregunta oral en Pleno.                                                                             | `intervenciones.tipo_iniciativa`                                 |
| `NUMEXPEDIENTE`                         | 99 %      | 410/000001/0000                                                                                     | `intervenciones.expediente`                                      |
| `OBJETOINICIATIVA`                      | 100 %     | título de la iniciativa                                                                             | Contexto                                                         |
| `AUTOR`                                 | 99 %      | autor de la iniciativa debatida (no del discurso)                                                   | No se usa                                                        |

Hechos comprobados:

- **Formato del orador:** «Apellidos, Nombre (GRUPO)» en el 81 % de las filas; a veces el sufijo lleva paréntesis anidados, como `(GV (EAJ-PNV))`; un 15 % no lleva sufijo. Los oradores incluyen miembros del Gobierno, senadores (grupos `SGPP`, `SGPS`…) y comparecientes externos.
- **Duplicados:** una misma intervención se repite una vez por cada iniciativa debatida conjuntamente (mismo `ENLACEDIFERIDO`, distinto `NUMEXPEDIENTE`). Hay 32.952 intervenciones distintas en 43.042 filas, y 30 filas idénticas. El recuento por diputado debe deduplicar por `ENLACEDIFERIDO`.
- Las preguntas orales aparecen aquí (6.364 filas con `TIPOINICIATIVA` de pregunta): son visibles como intervenciones, aunque las preguntas escritas no estén en datos abiertos.

### 3.4 Iniciativas

Página índice: [opendata/iniciativas](https://www.congreso.es/es/opendata/iniciativas).

| Prefijo                            | Filas | Autoría                                                 | Comentario                                                                                                    |
| ---------------------------------- | ----- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `ProposicionesDeLey`               | 371   | Grupos (306), Senado (47), CCAA (16), **Diputados (2)** | `AUTOR` puede listar varios grupos separados por saltos de línea                                              |
| `ProyectosDeLey`                   | 115   | Gobierno (100 %)                                        | Sin autoría de diputados                                                                                      |
| `PropuestasDeReforma`              | 2     | Parlamentos autonómicos                                 | Sin autoría de diputados                                                                                      |
| `IniciativasLegislativasAprobadas` | 176   | —                                                       | Solo `TIPO` (Leyes, Leyes organicas, Reales decretos), número, título, BOE y PDF. **Sin expediente ni autor** |

Campos de `ProposicionesDeLey` y `ProyectosDeLey`: `LEGISLATURA`, `SUPERTIPO`, `AGRUPACION`, `TIPO`, `OBJETO`, `NUMEXPEDIENTE` (clave, 100 %), `FECHAPRESENTACION`, `FECHACALIFICACION`, `AUTOR`, `TIPOTRAMITACION`, `RESULTADOTRAMITACION` (estado y fecha en un mismo texto: «Caducado \n04/11/2026»), `SITUACIONACTUAL` (todas «Cerrado» tras la disolución), `COMISIONCOMPETENTE`, `PLAZOS`, `PONENTES` (lista de diputados, solo en 46 iniciativas), `TRAMITACIONSEGUIDA`, `INICIATIVASRELACIONADAS`, `INICIATIVASDEORIGEN`, `ENLACESBOCG`, `ENLACESDS`.

Resultados de las proposiciones de ley: 213 caducadas por la disolución, 56 rechazadas, 50 retiradas, 28 decaídas, 12 aprobadas, 12 en otros estados.

### 3.5 Órganos

Página índice: [opendata/organos](https://www.congreso.es/es/opendata/organos). No enlaza ficheros: el usuario elige legislatura y órgano y pulsa «Exportar datos composición», que hace un POST y descarga un adjunto.

| Paso                         | Petición                                                                                                                                                                                                              | Respuesta                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Lista de comisiones          | POST `/es/opendata/organos?p_p_id=opendata&p_p_lifecycle=2&…&p_p_resource_id=resourceIDOrganos` con `_opendata_tipoConsulta=3` (4 = subcomisiones) y `_opendata_legislatura=15`                                       | JSON `datosOrganos[]` con `descOrgano` y `urlExport` (50 comisiones en la XV) |
| Composición de una comisión  | POST `/es/organos/composicion-en-la-legislatura?…&p_p_resource_id=opendataExport` con `_organos_selectedOrganoSup=1`, `_organos_selectedSuborgano=<código>`, `_organos_compoHistorica=true`, `_organos_fileType=json` | Adjunto `Composicion_<órgano>_15.json`                                        |
| Mesa / Diputación Permanente | Mismo POST sobre `/es/mesa` (`selectedOrganoSup=100`) o `/es/diputacion-permanente` (`500`), con `selectedSuborgano` vacío                                                                                            | Adjunto JSON                                                                  |

Campos de la exportación: `Nombre` («Apellidos, Nombre»), `Cargo` (Presidente, Vicepresidente Primero, Portavoces, Vocales…), `FechaAlta`, `FechaBaja` (con `compoHistorica=true` incluye a quien ya salió), `NombreOrgano`, `Grupo` (código corto, como en votaciones). La Junta de Portavoces no se ha probado todavía.

La lista de miembros del Gobierno **no está** en ninguna familia, y `CARGOORADOR` en intervenciones no es fiable para obtenerla: contiene cargos ministeriales atribuidos a personas que no lo eran. Se ha construido desde el BOE (D-007): 18 diputados de la XV fueron miembros del Gobierno durante su mandato.

### 3.6 Agendas de los diputados (fuente adicional, D-017)

Recurso JSON `agendaDiputados` de la ficha de cada diputado, una semana por petición ([fuentes-adicionales.md](fuentes-adicionales.md), sección 2.4). Comprobado el 23/11/2026 con 3 semanas de muestra de cada uno de los 137 diputados en activo:

| Hecho                | Detalle                                                                                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Campos por cita      | `fechaAgenda`, `horaAgenda1` y `horaAgenda2` (hora sobre la fecha ficticia 2001-01-01), `agendaCodOrgAbr` (órgano o texto libre) y `textoAgenda` (vacío en todas las citas vistas)         |
| Agenda institucional | Solo sesiones del **Pleno** (822 citas en la muestra, el mismo calendario para todos). Las comisiones no aparecen.                                                                         |
| Agenda personal      | Texto libre en `agendaCodOrgAbr` («Reunión…», «Acto…»), a veces con nombres de terceros. 22 de los 137 diputados tienen citas personales en la muestra (114 citas, desde febrero de 2026). |
| Días con agenda      | `diasConAgenda` es igual para todos los diputados: 208 días en 99 semanas, el calendario institucional. No indica qué semanas tienen citas personales.                                     |
| Disponibilidad       | Responde `tieneAgenda: false` para quienes causaron baja.                                                                                                                                  |

Clasificación que aplica ESCAÑO: una cita es institucional solo si su etiqueta coincide exactamente con el nombre de un órgano oficial (`config/agenda.ts`). Las demás son personales y se guardan sin texto, solo con fecha y horas. Las reuniones de partido con nombres como «Comisión Ejecutiva…» quedan correctamente como personales.

## 4. Cruce de identidades

**Todos los registros de diputados de la XV Legislatura quedan identificados por su nombre**: 100 % en votaciones, intervenciones y órganos, con 6 alias revisados a mano en [`config/overrides.ts`](../config/overrides.ts). Comprobado sobre el corpus completo el 23/11/2026, no sobre muestras.

| Fuente                                                    | Registros revisados             | Cruzan exacto          | Con alias              | Sin cruzar, y por qué                                                                       |
| --------------------------------------------------------- | ------------------------------- | ---------------------- | ---------------------- | ------------------------------------------------------------------------------------------- |
| Votos nominales (las 2.173 votaciones nominales de la XV) | 760.518                         | 758.915                | 1.603 (1 variante)     | Ninguno                                                                                     |
| Intervenciones, sin Diputación Permanente                 | 31.051 intervenciones distintas | Todas las de diputados | 51 filas (5 variantes) | Oradores que no son diputados del Congreso: senadores, ministros sin escaño, comparecientes |
| Composición de órganos (64 exportaciones)                 | 3.890 pertenencias              | 3.514                  | —                      | 252 senadores (comisiones mixtas) y 124 letrados de las comisiones                          |

Comprobaciones que respaldan el cruce:

- **Lista de cada votación = censo en activo ese día.** En las 2.173 votaciones nominales, el conjunto de votantes coincide exactamente con los diputados del censo en activo en esa fecha. La única ambigüedad es el día de la baja: 6 diputados ya no figuran en la lista ese día y 1 todavía vota. Por eso el denominador de participación se toma de la lista de cada votación, no de las fechas del censo.
- **Ningún diputado del censo desaparece.** Los 412 aparecen en las votaciones salvo 2 que causaron baja antes de la primera votación (Batet Lamaña y Marín González, septiembre de 2023).
- **Ningún orador con grupo del Congreso queda sin cruzar.** Todos los oradores con sufijo `GP`, `GS`, `GVOX`, `GSUMAR`, `GMx`, `GR`, `GJxCAT`, `GEH Bildu` o `GV (EAJ-PNV)` están en el censo o en la tabla de alias.
- **Falsos parecidos descartados.** El fichero rotula «Diputado» a 4 senadores de comisiones mixtas y a un compareciente; los mismos apellidos no bastan para unir (ej. la senadora «Moreno Fernández, Cristina» no es la diputada «Moreno Fernández, Mª Isabel»). Están listados en `notDeputies`.
- **Cargo y fecha importan en intervenciones.** 796 intervenciones de personas del censo ocurren fuera de su mandato: ministros que renunciaron al escaño y siguieron interviniendo como ministros, o exdiputados que comparecen en otro cargo. Solo cuentan las de diputados en activo que hablan como diputados o con un cargo parlamentario (presidencia de comisión, Mesa).

Cómo se encuentran y validan los alias: se normalizan los nombres (sin tildes, «Mª» = «María», sin conectores como «i» o «de») y se proponen pares con los mismos apellidos y nombres de pila compatibles («Pilar» ⊂ «María Pilar»). Cada propuesta se confirma a mano con fechas de mandato, grupo y tipo de actividad, y se anota con su evidencia. El pipeline nunca une nombres por parecido.

## 5. Correspondencia con el modelo de datos (sección 5)

| Tabla            | Fuente                                                        | Viable                           | Ajuste necesario                                                                            |
| ---------------- | ------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| `diputados`      | `DiputadosActivos` + `DiputadosDeBaja`                        | Sí                               | Sin código oficial ni `url_ficha_oficial`                                                   |
| `grupos`         | Censo + códigos de votaciones y órganos                       | Sí                               | Tabla de correspondencia nombre ↔ código                                                    |
| `organos`        | Exportación de órganos + `ORGANO` de intervenciones           | Sí                               | Los nombres de `ORGANO` vienen abreviados y con saltos de línea; correspondencia manual     |
| `pertenencias`   | Exportación de órganos                                        | Sí                               | Una petición por órgano: unas 50 comisiones más subcomisiones, Mesa y Diputación Permanente |
| `votaciones`     | ZIP por sesión                                                | Sí                               | `votacion_id` = legislatura + sesión + número                                               |
| `votos`          | ZIP por sesión                                                | Sí, salvo secretas y llamamiento | `telematico` es una inferencia                                                              |
| `intervenciones` | `IntervencionesCronologicamente`                              | Sí                               | Deduplicar por `ENLACEDIFERIDO`; descartar `Votación`                                       |
| `iniciativas`    | `ProposicionesDeLey`, `ProyectosDeLey`, `PropuestasDeReforma` | Sí como catálogo                 | No sirve para atribuir autoría individual                                                   |

## 6. Métricas viables y no viables

| Dimensión                 | Métrica                              | Veredicto     | Estado          | Motivo                                                       |
| ------------------------- | ------------------------------------ | ------------- | --------------- | ------------------------------------------------------------ |
| Dedicación                | Participación en votaciones de Pleno | **Viable**    | `observado`     | Voto nominal de los 350 escaños                              |
| Participación en debates  | Intervenciones en Pleno              | **Viable**    | `observado`     | `ORGANO = Pleno`, orador identificado                        |
| Participación en debates  | Intervenciones en comisión           | **Viable**    | `observado`     | `ORGANO` distingue cada comisión                             |
| Productividad legislativa | Iniciativas legislativas firmadas    | **No viable** | `no_disponible` | 2 de 371 proposiciones son de diputados; el resto, de grupos |
| Resultados e impacto      | Iniciativas aprobadas                | **No viable** | `no_disponible` | Las aprobadas no traen autor ni expediente                   |
| Representación ciudadana  | —                                    | **No viable** | `no_disponible` | Sin fuente (ya previsto)                                     |

Cobertura resultante: 2 de 5 dimensiones, 40 %, justo el mínimo para publicar índice global. Alternativas para el propietario en [decisions.md](decisions.md) (D-006).

## 7. Comprobación desde GitHub Actions

**Las descargas funcionan desde GitHub Actions.** El workflow [`discovery.yml`](../.github/workflows/discovery.yml) ejecuta `pnpm discover` en los servidores de GitHub. La [ejecución n.º 1](https://github.com/garciaba/escrutiniopublico/actions/runs/45141907020), del 23/11/2026, pasó las 19 comprobaciones en 59 segundos: 5 páginas índice, 7 ficheros, calendario y 2 sesiones de votaciones, lista de comisiones y 3 exportaciones de órganos. El mismo resultado se obtuvo en local. El informe queda como artefacto `discovery-report` de la ejecución.

Hallazgo relevante para esa comprobación: el cortafuegos del Congreso responde **403** a algunos `User-Agent` (`curl/…`, `Python-urllib/…`, cabecera vacía y uno que incluía la URL del repositorio). `ESCANO/0.1` es aceptado. Ver D-003.

## 8. Tablas normalizadas (hito 1)

Resultado de la ejecución completa de la XV (23/11/2026). Una segunda ejecución sin cambios en origen escribe exactamente los mismos bytes.

| Tabla            | Filas   | Notas                                                                                                                                                                                                      |
| ---------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diputados`      | 412     | 412 códigos oficiales distintos; 18 con rol `gobierno`, 17 `portavoz`, 9 `mesa`                                                                                                                            |
| `grupos`         | 9       |                                                                                                                                                                                                            |
| `organos`        | 67      | 64 de las exportaciones más Pleno, Diputación Permanente y Sesión Conjunta                                                                                                                                 |
| `pertenencias`   | 3.724   | Sin senadores ni letrados                                                                                                                                                                                  |
| `votaciones`     | 2.175   | 2.173 nominales; 2 secretas                                                                                                                                                                                |
| `votos`          | 760.518 | Lista de votantes igual al censo en activo en cada votación                                                                                                                                                |
| `intervenciones` | 26.524  | 24.121 cuentan; 2.403 excluidas con motivo (D-009, D-013)                                                                                                                                                  |
| `iniciativas`    | 50.394  | 47.414 preguntas escritas (44.845 al Gobierno, con 4 no servidas por el buscador, D-022; y 2.569 a RTVE), 2.492 solicitudes de informe de cuatro tipos (D-027) y 488 proyectos, proposiciones y propuestas |
| `firmantes`      | 279.334 | Todos los firmantes cruzan con el censo; los autores que no son diputados se listan en el registro                                                                                                         |

`pnpm pipeline` escribe estas tablas en `data/normalized/`, en CSV UTF-8 con cabecera, ordenadas por su clave para que el diff diario muestre solo cambios reales. Las fechas van en formato `aaaa-mm-dd` y los textos oficiales, sin saltos de línea internos. Una columna vacía significa que el dato oficial no existe.

### diputados (clave `diputado_id`)

| Columna                                             | Origen                                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `diputado_id`                                       | `L15-` + SHA-256 del nombre normalizado y la legislatura (D-008)                                                               |
| `legislatura`                                       | `config/project.ts`                                                                                                            |
| `cod_parlamentario`                                 | `codParlamentario` del buscador de diputados (D-015)                                                                           |
| `nombre_completo`, `nombre`, `apellidos`            | `NOMBRE` del censo («Apellidos, Nombre»)                                                                                       |
| `slug`                                              | «nombre-apellidos» sin tildes; si se repite, se añade el código                                                                |
| `grupo_id`                                          | `GRUPOPARLAMENTARIO` traducido al código corto (`config/parties.ts`)                                                           |
| `formacion`, `partido`                              | `FORMACIONELECTORAL`; `partido` agrupa federaciones (PSC-PSOE → PSOE)                                                          |
| `circunscripcion`, `id_circunscripcion`             | `CIRCUNSCRIPCION`; `idCircunscripcion` del buscador (código INE de provincia)                                                  |
| `fecha_alta`, `fecha_baja`, `fecha_condicion_plena` | `FECHAALTA`, `FECHABAJA`, `FECHACONDICIONPLENA`                                                                                |
| `fecha_alta_grupo`, `fecha_baja_grupo`              | `FECHAALTAENGRUPOPARLAMENTARIO`, `FECHABAJAENGRUPOPARLAMENTARIO` (solo el último grupo)                                        |
| `url_ficha_oficial`                                 | Ficha del diputado en congreso.es, construida con el código (D-011)                                                            |
| `rol_especial`                                      | `gobierno` (BOE, D-007), `mesa` (miembro de la Mesa), `portavoz` (portavoz titular en la Junta de Portavoces), separados por ` | `   |

### grupos (clave `grupo_id`)

`grupo_id`, `nombre` y `nombre_corto` salen de `config/parties.ts`. `miembros_censo` cuenta los diputados del censo cuyo último grupo es ese.

### organos (clave `organo_id`)

`organo_id` vale `pleno`, `mesa`, `junta-portavoces`, `diputacion-permanente` o `sesion-conjunta`, o bien `c<organoSup>-<suborgano>` para comisiones y subcomisiones. `nombre` es el nombre oficial de la exportación y `tipo` lo clasifica (comisión, mixta, de investigación, subcomisión…). `organo_sup` y `suborgano` son los códigos de la exportación. Las etiquetas abreviadas del fichero de intervenciones se traducen con `config/organos.ts`.

### pertenencias (clave `diputado_id + organo_id + fecha_inicio + cargo`)

Una fila por diputado, órgano y cargo, desde la exportación de composición con `compoHistorica=true`: `Cargo` → `cargo`, `FechaAlta` → `fecha_inicio`, `FechaBaja` → `fecha_fin`, `Grupo` → `grupo_id`. Se excluyen senadores (grupos `SG*`) y letrados. El cargo forma parte de la clave porque una misma persona puede tener dos cargos en un órgano desde el mismo día.

### votaciones (clave `votacion_id`)

`votacion_id` = `L15-S<sesión>-V<número>`. Del JSON de cada votación salen fecha, título, texto del expediente, subgrupo, número de votaciones conjuntas, asentimiento y totales (`presentes`, `a_favor`, `en_contra`, `abstenciones`, `no_votan`). `nominal` vale `false` en las secretas. `url_fuente` es el ZIP de la sesión. Las votaciones por llamamiento (sesiones 5 y 203 de la XV) no tienen JSON y no aparecen.

### votos (clave `votacion_id + diputado_id`)

`sentido`: `si`, `no`, `abstencion` o `no_vota`. `telematico` vale `true` cuando `asiento = -1` (D-010). `grupo_id` es el código de grupo que figura en esa votación, de modo que guarda el historial de grupo que el censo no tiene.

### intervenciones (clave `intervencion_id`)

Una fila por intervención distinta (`ENLACEDIFERIDO`) de un diputado del censo; las filas repetidas por debate conjunto se funden y sus expedientes se guardan en `expedientes`, separados por `;`. `intervencion_id` es el identificador del vídeo (ej. `1525087I`).

| Columna                       | Origen                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `fecha`, `organo_id`          | `SESION`, `ORGANO`                                                                                      |
| `cargo_orador`, `clase_cargo` | `CARGOORADOR` y su clase: `diputado`, `cargo_parlamentario`, `investidura`, `gobierno` o `externo`      |
| `fase`, `tipo_iniciativa`     | `FASE`, `TIPOINICIATIVA`                                                                                |
| `hora_inicio`, `hora_fin`     | `INICIOINTERVENCION`, `FININTERVENCION`                                                                 |
| `cuenta`, `motivo_exclusion`  | Regla de D-009 y D-013: `fuera_de_mandato`, `diputacion_permanente`, `cargo_gobierno` o `cargo_externo` |
| `url_fuente`, `url_video`     | `ENLACETEXTOINTEGRO` (o `ENLACEPDF`) y el primer enlace de `ENLACEDIFERIDO`                             |

Un cargo de Gobierno que el BOE no confirma para esa persona y fecha se trata como error de rotulación y la intervención cuenta como de diputado.

### iniciativas (clave `iniciativa_id`)

`iniciativa_id` es el expediente sin el sufijo `/0000` (ej. `184/044756`), y `tipo_codigo` son sus tres primeras cifras. Salen de los ficheros de proyectos de ley (121), proposiciones de ley de grupos (122), de diputados (123), del Senado (124) y de comunidades autónomas (125), y propuestas de reforma de estatuto (127), y de la exportación del buscador para preguntas escritas al Gobierno (184) y a la Corporación RTVE (179), y solicitudes de informe a la Administración del Estado (186), comunidades autónomas (187), entidades locales (188) y otras entidades públicas (189). `resultado` y `fecha_resultado` separan el texto «Caducado \n04/11/2026». `autor` conserva el autor textual de proyectos y proposiciones (grupos, Gobierno, Senado). `firmantes_incompletos` marca autorías del tipo «… y 45 Diputados». El fichero de leyes aprobadas no se ingiere, porque no trae expediente ni autor.

### firmantes (clave `iniciativa_id + orden`)

Tabla añadida al modelo de la especificación (D-016): una fila por diputado firmante, en el orden de la autoría oficial (`orden = 1` es el primer firmante), con su `grupo_id` y el total `n_firmantes` para el crédito fraccional.

## 9. Salidas para la web (hito 2)

La etapa `metrics` de `pnpm pipeline` lee las tablas de `data/normalized/` y escribe `data/derived/`. Todo se calcula con `config/scoring.ts` (metodología 1.0.0) para una fecha de cálculo; con las mismas tablas y la misma fecha, `ranking.json` y las fichas salen idénticos byte a byte.

Resultado para la XV con fecha de cálculo 23/11/2026:

| Periodo          | Estado        | Ventana                 | Población de referencia | Cobertura |
| ---------------- | ------------- | ----------------------- | ----------------------- | --------- |
| Legislatura      | Disponible    | 17/08/2023 – 06/10/2026 | 392                     | 60 %      |
| Último año       | Disponible    | 24/11/2025 – 06/10/2026 | 347                     | 60 %      |
| Último trimestre | No disponible | —                       | —                       | —         |
| Último mes       | No disponible | —                       | —                       | —         |

En la legislatura, 392 diputados tienen posición, 16 quedan fuera del ranking por ser miembros del Gobierno (D-024) y 4 por periodo insuficiente.

### `ranking.json`

| Campo                                                 | Contenido                                                                                                                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metodologia_version`, `fecha_calculo`, `legislatura` | Versión de la metodología, fecha de cálculo y datos de la legislatura (`finalizada` indica si ya terminó)                                                                        |
| `dimensiones`, `metricas`, `grupos`                   | Definiciones que usa la web: nombre, peso, estado y unidad                                                                                                                       |
| `periodos[]`                                          | Por periodo: `estado`, `motivo` si no está disponible, ventana (`desde`, `hasta`), `dias_minimos`, `poblacion_referencia`, `total_ranking`, `cobertura` y `metricas_disponibles` |
| `filas[]`                                             | Una fila por diputado y periodo disponible, una por línea en el fichero                                                                                                          |

Cada fila: `periodo`, `slug`, `nombre`, `grupo` (el del periodo), `partido`, `circunscripcion`, `roles`, `situacion` (`ranking`, `gobierno` o `periodo_insuficiente`), `indice`, `cobertura`, `posicion` y `dimensiones` (puntuación por dimensión; `null` si no tiene dato).

### `diputados/<slug>.json`

| Bloque                     | Contenido                                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diputado`                 | Identidad: nombre, código oficial, grupo, formación, partido, circunscripción, fechas y enlace a la ficha oficial                                                    |
| `gobierno[]`               | Etapas en el Gobierno con cargos, fechas y referencias del BOE                                                                                                       |
| `cargos[]`                 | Pertenencias a órganos: órgano, cargo, desde y hasta                                                                                                                 |
| `periodos.<id>`            | Situación, días (`dias_activo`, `dias_gobierno`, `dias_evaluados`), grupo, roles, índice, cobertura, posición y `total_ranking`, puntuación por dimensión y métricas |
| `evolucion`                | Serie mensual de cada métrica disponible: `meses` y `series.<métrica>` alineadas                                                                                     |
| `ultimas_votaciones[]`     | Las 20 últimas votaciones en lista: fecha, título, asunto, sentido del voto, telemático y enlace                                                                     |
| `ultimas_intervenciones[]` | Las 20 últimas intervenciones: fecha, órgano, tipo de iniciativa, si cuenta y por qué no, y enlaces                                                                  |

Cada métrica sigue el contrato de la especificación: `id`, `dimension`, `estado` (`observado`, `calculado` o `no_disponible`), `valor`, `numerador`, `denominador`, `percentil`, `percentil_grupo` y `fuente` (`nombre`, `url`, `fecha_dato`). Se añaden `n_grupo` (diputados del grupo en la población de referencia), `motivo` cuando no está disponible y `detalle` en las métricas de iniciativas (`firmadas` y `primer_firmante`).

| Métrica                                           | `valor`                     | `numerador`                                             | `denominador`                             |
| ------------------------------------------------- | --------------------------- | ------------------------------------------------------- | ----------------------------------------- |
| `votaciones_participacion`                        | Proporción de 0 a 1         | Votos emitidos                                          | Votaciones nominales en cuya lista figura |
| `intervenciones_pleno`, `intervenciones_comision` | Intervenciones por 100 días | Intervenciones que cuentan                              | Días evaluados                            |
| `preguntas_escritas`, `solicitudes_informe`       | Crédito por 100 días        | Crédito fraccional (1/n por iniciativa con n firmantes) | Días evaluados                            |

### `meta.json`

`ejecutado` (fecha y hora de la ejecución), `fecha_calculo`, `metodologia_version`, `commit`, resumen de `periodos`, `fuentes` (URL, fecha de descarga y fecha del fichero oficial de cada volcado), `fechas_dato` por familia, `registros` (filas de cada tabla normalizada) e `incidencias` (lo que la fuente oficial no pudo servir, D-022). Es el único fichero que cambia en cada ejecución.
