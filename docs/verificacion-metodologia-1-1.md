# Verificación de la metodología 1.1.0

Comprobado el 23/11/2026 sobre la XV Legislatura, con fecha de cálculo 23/11/2026. Los cambios y sus motivos están en la decisión D-033 de [decisions.md](decisions.md).

## Preguntas orales

**Descarga.** La exportación del buscador sirvió todos los registros de los tres tipos, sin bloques fallidos:

- 1.205 de 1.205 en Pleno.
- 1.976 de 1.976 en comisión.
- 607 de 607 a RTVE.

**Contraste con el cuadro de totales de cada diputado en congreso.es**, el mismo del Hito 2:

| Diputado                      | Web | Pleno (180) | Comisión (181) | RTVE (178) | Suma | Convertidas en escritas |
| ----------------------------- | --- | ----------- | -------------- | ---------- | ---- | ----------------------- |
| Pueyo Sanz, Jorge             | 9   | 1           | 8              | 0          | 9    | 6                       |
| Cuesta Rodríguez, María       | 51  | 0           | 51             | 0          | 51   | 5                       |
| Miñones Conde, José           | 0   | 0           | 0              | 0          | 0    | 0                       |
| Belarra Urteaga, Ione         | 41  | 36          | 5              | 0          | 41   | 2                       |
| Armengol Socias, Francina     | 0   | 0           | 0              | 0          | 0    | 0                       |
| Sánchez Pérez-Castejón, Pedro | 0   | 0           | 0              | 0          | 0    | 0                       |
| Rego Candamil, Néstor         | 188 | 11          | 177            | 0          | 188  | 146                     |
| Ogou i Corbi, Viviane         | 0   | 0           | 0              | 0          | 0    | 0                       |
| Abascal Conde, Santiago       | 19  | 19          | 0              | 0          | 19   | 0                       |
| Ábalos Meco, José Luis        | 0   | 0           | 0              | 0          | 0    | 0                       |
| Sierra Caballero, Francisco   | 53  | 0           | 2              | 51         | 53   | 0                       |

- La suma de los tres tipos coincide con la web en los once diputados.
- Sierra Caballero confirma que la web incluye las preguntas orales a RTVE.
- La métrica cuenta las «Convertidas» solo como preguntas escritas (D-033). Por eso, en la ficha de Rego Candamil figuran 42 preguntas orales y no 188.

## Ponencias

- Las 688 designaciones de los ficheros oficiales cruzan con el censo por nombre exacto, sin ningún alias.
- 46 leyes tienen ponencia: 29 aprobadas, 11 caducadas con la disolución, 2 rechazadas, 1 retirada y 3 subsumidas en otra iniciativa.
- Las 34 leyes aprobadas de la XV tienen fecha de conclusión y todas caen dentro de la legislatura. Con la fecha del campo de resultado, dos habrían quedado fuera (D-033).
- Con la fecha corregida, 187 de los 392 diputados del ranking tienen al menos una ley aprobada en su ponencia.

## Doble recuento

- 2.590 intervenciones son la formulación de una pregunta oral propia. Ya no suman en «Participación en debates».
- Entre las que cuentan y estas suman 24.121, las mismas que contaban con la metodología 1.0.0.
- 419 preguntas orales convertidas en escritas no suman en la métrica oral. 393 se han localizado como pregunta escrita con el mismo título y autor.

## Reproducibilidad y tests

- Una segunda ejecución de `pnpm pipeline --offline --date 2026-11-23` escribe los mismos bytes en `data/normalized/` y en `data/derived/` (`meta.json` aparte).
- 182 tests (`pnpm test`), 15 de ellos nuevos. Cubren:
  - el crédito de las preguntas orales y la exclusión de las convertidas;
  - las leyes de la ponencia, contadas en su fecha de conclusión y fuera de los días en el Gobierno;
  - la marca `pregunta_oral` en las intervenciones;
  - el tiempo de palabra, también a través de la medianoche;
  - la lectura del campo oficial de ponentes, con una muestra real reducida.
- La web compila las 418 páginas y pasa `pnpm web:audit` y `pnpm web:check` (axe-core, tabla y privacidad) sin problemas.
