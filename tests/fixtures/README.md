# Muestras de los ficheros oficiales

Todo lo que hay en `congreso/` son **datos reales** del [portal de datos abiertos del Congreso de los Diputados](https://www.congreso.es/es/datos-abiertos), descargados el 23 de noviembre de 2026 y **reducidos** para los tests. No hay datos ficticios; si algún test los necesita, irán en otra carpeta y marcados como tales.

Reducciones aplicadas:

- Se conservan pocas filas de cada fichero, elegidas para cubrir casos límite (votos de cada sentido, voto con `asiento = -1`, intervención con grupo anidado, intervención repetida por debate conjunto, filas `Votación` sin orador…).
- En las muestras de votaciones marcadas `.sample`, la lista `votaciones` está recortada, así que no suma los `totales`. `sesion202votacion21.json` (votación secreta) está completo.
- El campo `BIOGRAFIA` del censo se sustituye por `[omitido en la muestra]` (ver D-014 en `docs/decisions.md`).
- Las páginas HTML de `index/` conservan solo los fragmentos que lee el pipeline (enlaces de descarga, selector de legislatura, calendario `diasVotaciones` y bloque de sesión).
- Codificaciones originales: los CSV son UTF-8 con BOM y CRLF; el XML de votaciones es ISO-8859-1.

| Carpeta | Origen |
| --- | --- |
| `index/` | Páginas índice de diputados y votaciones, y página del día 30/09/2026 |
| `diputados/` | `DiputadosActivos__20261123050005/6`, `DiputadosDeBaja__20261123050008` |
| `votaciones/` | ZIP de las sesiones 202 (30/09/2026) y 40 (23/05/2024) |
| `intervenciones/` | `IntervencionesCronologicamente__20261123050120` |
| `iniciativas/` | `ProposicionesDeLey`, `ProyectosDeLey`, `PropuestasDeReforma`, `IniciativasLegislativasAprobadas` del 23/11/2026 |
| `organos/` | Lista de comisiones y exportación de la Comisión Constitucional (XV) |
