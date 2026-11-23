# Verificación del Hito 4: automatización y despliegue

Comprobado el 23/11/2026 en la rama `claude/hito-4-despliegue`. Las decisiones están en D-035 de [decisions.md](decisions.md).

## En GitHub Actions

Primera ejecución de `ci.yml` (run 45219898062), correcta en 5 minutos:

| Paso                                                                      | Duración   | Resultado                                                       |
| ------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| Tipos, lint, formato y tests con cobertura (incluida la reproducibilidad) | 41 s       | Correcto                                                        |
| Compilación (418 páginas) y auditoría                                     | 6 s        | Correcto                                                        |
| Instalación de Playwright y comprobación en navegador                     | 68 s       | Correcto: axe-core, tabla, privacidad y aviso de datos antiguos |
| Lighthouse CI, 9 pasadas                                                  | 2 min 37 s | Correcto: rendimiento y accesibilidad ≥ 95                      |
| Previsualización en Cloudflare Pages                                      | 17 s       | Correcto                                                        |

El despliegue de previsualización confirma que los dos secretos funcionan:

- El token de la cuenta creó el proyecto de Pages `escrutiniopublico`.
- Se subieron 431 ficheros, con `_headers` incluido.
- La rama quedó publicada en https://claude-hito-4-despliegue.escrutiniopublico.pages.dev.

El aviso de GitHub por acciones que aún usan Node 20 venía de `pnpm/action-setup@v4`. Se ha pasado a la versión 6.1.1, que usa Node 24.

## En local

- 203 tests y cobertura en `pipeline/metrics` y `pipeline/normalize`: 96 % de sentencias, 98,6 % de líneas, 99 % de funciones y 84 % de ramas.
- `pnpm sanity` contra lo publicado: tres controles correctos y uno omitido, el de diputados en activo, porque la legislatura ha terminado. Mensaje generado: «Daily data check 2026-11-23: no changes in the official data».

## Primera ejecución diaria en `main`: fallo real, sin publicar

La primera ejecución de `daily.yml` (run 45242540422, lanzada a mano el 23/11/2026 a las 18:50 UTC) falló a los 22 minutos, en la descarga:

- **Causa.** El Congreso cambió ese día un registro: la solicitud de informe 187/000488 dejó de tener resultado, y el listado del buscador omite los campos vacíos. La validación del esquema detuvo la ejecución (`Schema check failed for listing 187 page 1`).
- **Comportamiento, el previsto en la sección 6:**
  - No hubo commit de datos ni despliegue.
  - Se abrió la incidencia #10, «Fallo del pipeline diario», con el enlace a la ejecución y el registro.
- **Corrección.** Un campo ausente en el listado se lee como vacío, igual que lo da la exportación (nota en D-022), con una muestra real del caso como test.

Este fallo real cubre el criterio «fallo de esquema: no despliega y abre incidencia» sin necesidad de simularlo. Falta ver que la siguiente ejecución correcta cierra la incidencia.

## Pendiente: requiere los PR fusionados en `main`

| Criterio de aceptación                                    | Cómo se comprobará                                                                                                                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tres ejecuciones diarias seguidas sin intervención        | El `cron` de GitHub solo corre en la rama por defecto. Bastará con revisar las tres primeras ejecuciones de `daily.yml` tras la fusión                                                                        |
| Fallo simulado de esquema: no despliega y abre incidencia | Ejecutar a mano «Daily pipeline» con `simular_fallo` marcado. Debe fallar en la normalización, no hacer commit ni desplegar, y abrir «Fallo del pipeline diario». La siguiente ejecución normal debe cerrarla |
| Aviso de datos antiguos                                   | Ya verificado en el navegador por `pnpm web:check`, con el reloj fijado a 1 h y a 49 h de la última ejecución. Sobre producción se verá si un día falla la ejecución                                          |
