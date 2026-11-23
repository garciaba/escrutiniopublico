# Verificación del Hito 3: web

Comprobado el 23/11/2026 sobre la compilación de la rama `claude/hito-3-web`, con los datos de la XV Legislatura (fecha de cálculo 23/11/2026, metodología 1.0.0).

**Resultado:** se cumplen los cuatro criterios de aceptación del hito y los requisitos de la sección 9 que dependen de la web. Queda una salvedad: las medidas de Lighthouse son locales, no sobre el dominio definitivo.

## Criterios de aceptación

| Criterio                                    | Resultado                                                                                                                               | Cómo se comprueba  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Sitio Astro con las seis rutas              | `/`, `/diputados/<slug>`, `/metodologia`, `/datos`, `/cambios` y `/acerca`, más `404`, `sitemap.xml` y `robots.txt`                     | `pnpm web:audit`   |
| Tabla con filtros y periodo en la URL       | Búsqueda, grupo, partido, circunscripción, orden, periodo y casilla del Gobierno; un enlace compartido abre la misma vista              | `pnpm web:check`   |
| 350 fichas generadas                        | 412: una por cada diputado que ha tenido escaño en la XV, incluidas altas y bajas                                                       | `pnpm web:audit`   |
| `/metodologia` generada desde configuración | Dimensiones, métricas, fórmulas, reglas, periodos y limitaciones salen de `config/scoring.ts`; la página no repite ninguna cifra a mano | Lectura del código |
| Umbrales de rendimiento y accesibilidad     | Ver las dos secciones siguientes                                                                                                        | Lighthouse y axe   |

## Rendimiento

Lighthouse 12.8.2 contra `pnpm web:preview` (servidor local con las cabeceras de producción y compresión gzip), con la simulación de móvil lenta por defecto.

| Página                     | Rendimiento | Accesibilidad | Buenas prácticas | SEO | FCP   | LCP   | Bloqueo | CLS |
| -------------------------- | ----------- | ------------- | ---------------- | --- | ----- | ----- | ------- | --- |
| Portada, móvil             | 100         | 100           | 100              | 100 | 1,4 s | 1,5 s | 10 ms   | 0   |
| Portada con filtros, móvil | 100         | 100           | 100              | 100 | 1,3 s | 1,5 s | 20 ms   | 0   |
| Portada, escritorio        | 100         | 100           | 100              | 100 | 0,4 s | 0,4 s | 0 ms    | 0   |
| Ficha de diputado, móvil   | 100         | 100           | 100              | 100 | 0,8 s | 0,9 s | 0 ms    | 0   |
| Metodología, móvil         | 100         | 100           | 100              | 100 | 0,8 s | 0,9 s | 0 ms    | 0   |

| Requisito                           | Límite | Medido                                       |
| ----------------------------------- | ------ | -------------------------------------------- |
| Lighthouse, rendimiento             | ≥ 95   | 100                                          |
| JavaScript comprimido en la portada | 60 kB  | 10,4 kB en 3 ficheros                        |
| JavaScript en las fichas            | 0 kB   | 0 kB: ninguna etiqueta `<script>` ejecutable |
| HTML de la portada, comprimido      | —      | 52,8 kB, con la tabla completa de 396 filas  |

Lighthouse avisa del tamaño del DOM de la portada (unos 10.500 elementos). Es el coste de servir la tabla completa sin JavaScript, que exige la especificación. No penaliza la nota: en móvil las tarjetas fuera de pantalla no se dibujan (`content-visibility`) y el navegador no recorre las filas al cargar (D-031).

**Salvedad:** falta repetir la medida sobre Cloudflare Pages con el dominio real. Se hará en el hito 4, con Lighthouse CI.

## Accesibilidad

`pnpm web:check` pasa axe-core 4.14 (reglas WCAG 2.0, 2.1 y 2.2, niveles A y AA, y buenas prácticas) en 9 páginas y 2 tamaños de pantalla, 1.280 y 390 px: **0 infracciones**.

- Páginas: portada (también después de buscar y ordenar), metodología, datos, cambios, acerca, 404 y tres fichas: un diputado del ranking, un miembro del Gobierno y un «periodo insuficiente».
- Corregido durante la verificación: las fórmulas de la metodología hacían scroll horizontal en móvil sin acceso por teclado. Ahora saltan de línea.

Revisión manual de la portada y de una ficha:

| Aspecto            | Resultado                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Teclado            | Enlace «Saltar al contenido»; controles y cabeceras de la tabla se manejan con tabulador, Intro y espacio; foco siempre visible             |
| Tablas             | Cabeceras de columna y de fila; el orden activo se anuncia con `aria-sort`; el recuento de resultados se anuncia al cambiar                 |
| Contraste          | Texto 16,5:1; texto secundario 6,5:1; acento 6,1:1                                                                                          |
| Gráficos           | Cada gráfico mensual tiene un resumen en texto; las barras son decorativas y la cifra va siempre al lado                                    |
| Dato no disponible | Raya con el texto «No disponible» para lectores de pantalla; nunca un cero; al ordenar, las filas sin dato van al final en los dos sentidos |
| Sin JavaScript     | La portada muestra la tabla completa por posición y avisa de que los filtros lo necesitan; el resto del sitio no usa JavaScript             |
| Móvil              | La tabla pasa a tarjetas y las tablas de las fichas se apilan; controles de 44 px de alto                                                   |

## Resto de requisitos de la sección 9

| Área          | Comprobación                                                                                                                                         | Resultado |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| Reutilización | Pie con «Fuente: Congreso de los Diputados», fecha de última actualización y aviso de no vinculación en las 418 páginas                              | Correcto  |
| Privacidad    | Tras recorrer el sitio y usar la tabla: 0 cookies, 0 entradas en el almacenamiento del navegador, ninguna petición a otro origen; no hay formularios | Correcto  |
| Seguridad     | Política de seguridad estricta en `_headers` (D-031); con ella activa, ninguna infracción en la consola                                              | Correcto  |
| Neutralidad   | El color de grupo es solo un punto junto al nombre; desplegables en orden alfabético; el test de `scoring.ts` sigue pasando                          | Correcto  |
| SEO           | Título y descripción propios en cada ficha, URL canónica, `sitemap.xml` con 417 direcciones, datos estructurados `Person` e imagen Open Graph        | Correcto  |
| Enlaces       | Ningún enlace interno roto en las 418 páginas                                                                                                        | Correcto  |

## Tests

167 tests (`pnpm test`), 46 de ellos nuevos, sobre la lógica de la web: formato de cifras y fechas, estado en la URL, filtros, orden con datos no disponibles, textos de la ficha y geometría de los gráficos. Los datos de esos tests son ficticios y están marcados como tales.

## Cómo repetirlo

```sh
pnpm install
pnpm test
pnpm web:build     # 418 páginas en web/dist
pnpm web:audit     # requisitos comprobables sin navegador
pnpm web:check     # axe-core, tabla y privacidad; necesita Playwright con Chromium
pnpm web:preview   # http://127.0.0.1:4321 con las cabeceras de producción
```

## Pendiente del propietario

- Titular, dirección de contacto y financiación para `/acerca` (D-032).
- Revisión jurídica de los textos de `/acerca` y de `/datos` (sección 12).
- Lectura de los textos públicos: son los de la especificación y la configuración, pero nadie más los ha revisado.
