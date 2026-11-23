# Verificación del Hito 2: diez fichas contrastadas con la web del Congreso

Contraste hecho el 23/11/2026 sobre el periodo «Legislatura» de la XV (17/08/2023 a 06/10/2026), con fecha de cálculo 23/11/2026 y metodología 1.0.0.

**Resultado:** en las diez fichas, los votos, las intervenciones, las solicitudes de informe y las preguntas escritas coinciden con las fuentes oficiales, con una sola diferencia explicada: 4 preguntas que el buscador del Congreso no puede servir. El contraste destapó tres defectos de la ingesta del Hito 1, ya corregidos; las cifras de abajo son las posteriores a la corrección.

## Cómo se contrastó

Cada ficha se comparó con tres fuentes independientes del cálculo de ESCAÑO:

| Dato                                        | Fuente del contraste                                                                              | Qué se compara                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Preguntas escritas y solicitudes de informe | «Cuadro estadístico» de la página «Iniciativas» de cada diputado en congreso.es                   | Número de iniciativas en las que figura como firmante |
| Intervenciones                              | Listado «Intervenciones» de cada diputado en congreso.es                                          | Número de intervenciones que lista la web             |
| Votaciones                                  | Recuento aparte, con un programa distinto del pipeline, sobre los JSON oficiales de cada votación | Votaciones en cuya lista figura y votos emitidos      |

Los diez diputados se eligieron para cubrir los casos difíciles: los cuatro grupos mayores y el Mixto, un alta a mitad de legislatura, una baja anticipada, un miembro del Gobierno, dos exministros en funciones, la Presidencia de la Cámara, dos nombres que necesitan alias y un cambio de grupo.

## Resultado por ficha

| Diputado                      | Caso                                                             | Situación e índice           | Preguntas escritas (web / ESCAÑO) | Solicitudes de informe (web / ESCAÑO) | Intervenciones (web / fichero oficial / distintas) | Votos emitidos de votaciones en lista (recuento aparte / ficha) |
| ----------------------------- | ---------------------------------------------------------------- | ---------------------------- | --------------------------------- | ------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| Pueyo Sanz, Jorge             | Primero del ranking; baja en enero de 2026                       | Ranking, n.º 1, 85,5         | 237 / 237                         | 7 / 7                                 | 151 / 151 / 97                                     | 1.637 de 1.637 / igual                                          |
| Cuesta Rodríguez, María       | Alias en votaciones («María del Socorro»)                        | Ranking, n.º 328, 38,0       | 1.280 / 1.276                     | 17 / 17                               | 27 / 27 / 26                                       | 2.167 de 2.173 / igual                                          |
| Miñones Conde, José           | Ministro en funciones hasta el 21/11/2023; baja en abril de 2024 | Ranking, n.º 392, 6,7        | 0 / 0                             | 0 / 0                                 | 0 / 0 / 0                                          | 171 de 175 / 165 de 169                                         |
| Belarra Urteaga, Ione         | Ministra en funciones hasta el 21/11/2023                        | Ranking, n.º 66, 61,7        | 169 / 169                         | 31 / 31                               | 196 / 196 / 158                                    | 2.164 de 2.173 / 2.158 de 2.167                                 |
| Armengol Socias, Francina     | Presidenta del Congreso                                          | Ranking, n.º 387, 16,2       | 0 / 0                             | 0 / 0                                 | 15 / 15 / 14                                       | 2.142 de 2.173 / igual                                          |
| Sánchez Pérez-Castejón, Pedro | Presidente del Gobierno                                          | Fuera del ranking (Gobierno) | 1 / 1                             | 0 / 0                                 | 368 / 368 / 300                                    | 1.055 de 2.173 / igual                                          |
| Rego Candamil, Néstor         | Único diputado de su formación; el que más pregunta              | Ranking, n.º 35, 67,2        | 3.766 / 3.766                     | 49 / 49                               | 650 / 650 / 491                                    | 2.077 de 2.173 / igual                                          |
| Ogou i Corbi, Viviane         | Alta en febrero de 2025; alias en intervenciones                 | Ranking, n.º 47, 64,4        | 36 / 36                           | 15 / 15                               | 103 / 108 / 98                                     | 1.271 de 1.275 / igual                                          |
| Abascal Conde, Santiago       | Presidente de grupo                                              | Ranking, n.º 378, 26,6       | 3 / 3                             | 1 / 1                                 | 101 / 101 / 60                                     | 2.137 de 2.173 / igual                                          |
| Ábalos Meco, José Luis        | Cambio de grupo; suspendido en sus derechos                      | Ranking, n.º 390, 12,5       | 18 / 18                           | 0 / 0                                 | 2 / 2 / 2                                          | 1.091 de 1.637 / igual                                          |

Cómo leer las columnas:

- **Intervenciones.** La web y el fichero oficial cuentan una fila por intervención e iniciativa debatida. ESCAÑO cuenta intervenciones distintas, por su enlace de vídeo (decisión D-009), y por eso la tercera cifra es menor.
- **Votos de Miñones y Belarra.** La ficha excluye las 6 votaciones celebradas mientras eran miembros del Gobierno en funciones (decisión D-024); el recuento aparte las incluye. La diferencia es exactamente esa: 6 votaciones, todas con voto emitido.

## Diferencias y su explicación

| Diferencia                                                              | Explicación                                                                                                                                                             | Estado                          |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Cuesta Rodríguez: 4 preguntas menos                                     | Son las 4 preguntas que el buscador del Congreso no puede servir (decisión D-022). El registro que lo rompe lo firman 14 diputados del mismo grupo.                     | Documentada; no recuperable hoy |
| Ogou i Corbi: la web lista 103 intervenciones y el fichero oficial, 108 | Cinco filas del fichero la nombran «Ogou Corbi, Viviane», sin la «i», y la web no las enlaza a su ficha. ESCAÑO las asigna mediante un alias revisado (decisión D-008). | Explicada                       |

## Defectos del Hito 1 que destapó este contraste

Los tres están corregidos y los datos, regenerados (decisión D-027):

| Defecto                                               | Cómo se vio                                                                        | Corrección                                                                                                                          | Efecto                                                                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Faltaban tres tipos de solicitud de informe           | Belarra: 31 en la web, 24 en ESCAÑO                                                | Se ingieren también los tipos 187 (comunidades autónomas), 188 (entidades locales) y 189 (otras entidades públicas), además del 186 | 577 solicitudes más                                                                                                          |
| Faltaban las preguntas escritas a la Corporación RTVE | Rego: 3.766 en la web, 3.757 en ESCAÑO                                             | Se ingiere también el tipo 179, que la ficha oficial suma con las preguntas al Gobierno (184)                                       | 2.569 preguntas más                                                                                                          |
| Se perdían firmantes escritos sin código de grupo     | Autores como «Catalán Higueras, Alberto», o dos nombres pegados con un solo código | El análisis de autores reconoce nombres sin código, solos o pegados al siguiente, siempre contra el censo                           | 51 firmas recuperadas en 29 preguntas; de paso se eliminan 5 firmas duplicadas (el mismo diputado dos veces en una pregunta) |

## Lo que este contraste no cubre

- Solo diez fichas de 412. Las preguntas y solicitudes se pueden contrastar de forma automática para todos los diputados con el mismo cuadro estadístico (412 peticiones); queda propuesto como control de sanidad del Hito 5.
- La web del Congreso no publica un recuento de votos por diputado: el contraste de votaciones es un recuento independiente sobre los mismos ficheros oficiales, no una segunda fuente.
