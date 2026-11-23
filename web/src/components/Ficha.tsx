/**
 * Profile of a deputy. Rendered only at build time: these pages ship no JavaScript,
 * so the monthly charts are plain SVG with a <title> per column.
 */
import { groups } from '../../../config/parties.ts';
import { scoring, type MetricConfig } from '../../../config/scoring.ts';
import type { Ficha, FichaPeriodo, Metrica } from '../lib/data.ts';
import { intervalo, periodoPrincipal, recortar, resumenEvolucion, valorBruto, valorMensual } from '../lib/ficha.ts';
import {
  fechaCorta,
  fechaLarga,
  iniciales,
  mes,
  motivoExclusion,
  motivoPeriodo,
  num,
  plural,
  porcentaje,
  rolEtiqueta,
  sentidoVoto,
} from '../lib/format.ts';
import { sparkBars } from '../lib/sparkline.ts';
import { Medidor, PuntoGrupo } from './parts.tsx';

const ORDEN_PERIODOS = scoring.periodos.map((periodo) => periodo.id);
const ESTADO_ETIQUETA = { observado: 'Observado', calculado: 'Calculado', no_disponible: 'No disponible' } as const;
const ESTADO_TITULO = {
  observado: 'Dato oficial directo',
  calculado: 'Indicador derivado de datos oficiales',
  no_disponible: 'Sin fuente oficial: no puntúa',
} as const;
const VISIBLES = 8;

function grupoDe(id: string) {
  return groups.find((group) => group.code === id);
}

function Cabecera({ ficha, periodo }: { ficha: Ficha; periodo: FichaPeriodo | undefined }) {
  const { diputado } = ficha;
  const grupo = grupoDe(diputado.grupo.id);
  const roles = (periodo?.roles ?? []).filter((rol) => rol !== 'gobierno');
  return (
    <header class="ficha-cabecera">
      <div class="avatar" aria-hidden="true">
        {iniciales(diputado.nombre, diputado.apellidos)}
      </div>
      <div>
        <h1>
          {diputado.nombre} {diputado.apellidos}
        </h1>
        <p class="ficha-grupo">
          <PuntoGrupo color={grupo?.color ?? '#9c9c9c'} />
          {diputado.grupo.nombre}
        </p>
        <p class="ficha-datos">
          <span>{diputado.partido}</span>
          <span>{diputado.circunscripcion}</span>
        </p>
      </div>
      <div class="ficha-extra">
        <span>En el escaño {intervalo(diputado.fecha_alta, diputado.fecha_baja)}</span>
        {roles.length > 0 || ficha.gobierno.length > 0 ? (
          <span class="etiquetas">
            {roles.map((rol) => (
              <span class="etiqueta">{rolEtiqueta(rol)}</span>
            ))}
            {ficha.gobierno.length > 0 ? <span class="etiqueta">Etapa en el Gobierno</span> : null}
          </span>
        ) : null}
        <a href={diputado.url_ficha_oficial} rel="noopener">
          Ficha oficial en congreso.es (diputado n.º {diputado.cod_parlamentario})
        </a>
      </div>
    </header>
  );
}

function Indice({ ficha, id, periodo }: { ficha: Ficha; id: string; periodo: FichaPeriodo }) {
  const nombrePeriodo = scoring.periodos.find((p) => p.id === id)?.nombre ?? id;
  const dimensiones = periodo.dimensiones ?? [];
  const conDato = dimensiones.filter((d) => d.puntuacion !== null).length;
  const minimo = scoring.poblacionReferencia.diasMinimos;
  const enRanking = periodo.situacion === 'ranking';
  return (
    <section class="bloque tarjeta indice" aria-labelledby="indice-titulo">
      <h2 id="indice-titulo">Índice de actividad</h2>
      <p class="muted">
        {nombrePeriodo}
        {periodo.desde ? `, ${intervalo(periodo.desde, periodo.hasta)}` : ''}
      </p>
      {enRanking && periodo.indice != null ? (
        <>
          <p class="indice-cifra">
            <span class="valor">{num(periodo.indice, scoring.decimales)}</span>
            <span class="de">de 100</span>
          </p>
          <Medidor valor={periodo.indice} clase="grueso" />
          {periodo.posicion != null ? (
            <p class="indice-posicion">
              N.º {num(periodo.posicion)} de {num(periodo.total_ranking ?? 0)}
            </p>
          ) : null}
        </>
      ) : null}
      {enRanking && periodo.indice == null ? (
        <>
          <p class="indice-fuera">Sin índice</p>
          <p class="indice-nota">
            No hay datos suficientes para calcularlo: hace falta al menos un {porcentaje(scoring.coberturaMinima, 0)} de
            cobertura.
          </p>
        </>
      ) : null}
      {periodo.situacion === 'gobierno' ? (
        <>
          <p class="indice-fuera">Fuera del ranking general</p>
          <p class="indice-nota">
            Miembro del Gobierno durante la mayor parte del periodo. Su actividad en la Cámara responde a esa función y
            no se compara con la del resto: no tiene posición.
          </p>
          {periodo.indice != null ? (
            <p class="indice-nota">
              Como referencia, con las mismas reglas su índice sería {num(periodo.indice, scoring.decimales)} de 100.
            </p>
          ) : null}
        </>
      ) : null}
      {periodo.situacion === 'periodo_insuficiente' ? (
        <>
          <p class="indice-fuera">Sin índice: periodo insuficiente</p>
          <p class="indice-nota">
            Estuvo en activo {num(periodo.dias_evaluados ?? 0)} {plural(periodo.dias_evaluados ?? 0, 'día', 'días')} del
            periodo; hacen falta {minimo} para calcular percentiles. Se muestran sus cifras brutas.
          </p>
        </>
      ) : null}
      {periodo.etapa_gobierno_excluida ? (
        <p class="indice-nota">
          No se evalúan los {num(periodo.dias_gobierno ?? 0)} días en que fue miembro del Gobierno: el índice cubre los{' '}
          {num(periodo.dias_evaluados ?? 0)} restantes.
        </p>
      ) : null}
      {periodo.cobertura != null ? (
        <p class="indice-nota">
          Cobertura del {porcentaje(periodo.cobertura, 0)}: el índice se calcula con {conDato} de las{' '}
          {dimensiones.length} dimensiones. Las que no tienen fuente oficial no cuentan como cero.{' '}
          <a href="/metodologia">Cómo se calcula</a>
        </p>
      ) : null}
      {ficha.gobierno.map((etapa) => (
        <p class="indice-nota">
          {etapa.cargos}, {intervalo(etapa.desde, etapa.hasta)}. Fuente: BOE, {etapa.evidencia.join('; ')}.
        </p>
      ))}
    </section>
  );
}

function Dimensiones({ periodo }: { periodo: FichaPeriodo }) {
  const puntuaciones = new Map((periodo.dimensiones ?? []).map((d) => [d.id, d.puntuacion]));
  return (
    <section class="bloque tarjeta" aria-labelledby="dimensiones-titulo">
      <h2 id="dimensiones-titulo">Dimensiones</h2>
      <ul class="dimensiones">
        {scoring.dimensiones.map((dimension) => {
          const puntuacion = puntuaciones.get(dimension.id) ?? null;
          const conFuente = scoring.metricas.some((m) => m.dimension === dimension.id && m.estado !== 'no_disponible');
          return (
            <li class={puntuacion === null ? 'dimension sin-dato' : 'dimension'}>
              <div class="dimension-cabeza">
                <span class="nombre">{dimension.nombre}</span>
                {puntuacion === null ? (
                  <span class="valor">No disponible</span>
                ) : (
                  <span class="valor">{num(puntuacion, scoring.decimales)}</span>
                )}
              </div>
              {puntuacion === null ? <Medidor valor={0} /> : <Medidor valor={puntuacion} />}
              <p>
                {dimension.descripcion}
                {puntuacion === null && conFuente ? ' Sin percentil en este periodo.' : ''}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Evolucion({ valores, meses, config }: { valores: (number | null)[]; meses: string[]; config: MetricConfig }) {
  const ancho = meses.length * 8;
  const alto = 32;
  const proporcion = config.unidad === 'proporcion';
  const barras = sparkBars(valores, meses, {
    width: ancho,
    height: alto,
    ...(proporcion ? { max: 1, marcarCeros: true } : {}),
  });
  if (meses.length === 0) return null;
  return (
    <figure class="evolucion">
      <p class="titulo">Evolución mensual</p>
      <svg
        class="chispa"
        viewBox={`0 0 ${ancho} ${alto}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={resumenEvolucion(valores, meses, config)}
      >
        {barras.map((barra) => (
          <rect x={barra.x} y={barra.y} width={barra.width} height={barra.height}>
            <title>
              {mes(barra.mes)}: {valorMensual(barra.valor, config)}
            </title>
          </rect>
        ))}
        <line class="base" x1="0" y1={alto} x2={ancho} y2={alto} />
      </svg>
      <figcaption>
        <span>{mes(meses[0] ?? '', true)}</span>
        <span>{mes(meses[meses.length - 1] ?? '', true)}</span>
      </figcaption>
    </figure>
  );
}

function TarjetaMetrica({ metrica, ficha }: { metrica: Metrica; ficha: Ficha }) {
  const config = scoring.metricas.find((m) => m.id === metrica.id);
  if (!config) return null;
  const dimension = scoring.dimensiones.find((d) => d.id === config.dimension);
  const bruto = valorBruto(metrica, config);
  const serie = ficha.evolucion.series[metrica.id];
  const cabeza = (
    <div class="metrica-cabeza">
      <div>
        <h3>{config.nombre}</h3>
        <p class="dim">{dimension?.nombre}</p>
      </div>
      <span
        class={
          metrica.estado === 'observado'
            ? 'etiqueta solida'
            : metrica.estado === 'calculado'
              ? 'etiqueta'
              : 'etiqueta rayada'
        }
        title={ESTADO_TITULO[metrica.estado]}
      >
        {ESTADO_ETIQUETA[metrica.estado]}
      </span>
    </div>
  );
  if (!bruto) {
    return (
      <article class="metrica tarjeta sin-dato">
        {cabeza}
        <p class="motivo">{metrica.motivo ?? ('motivo' in config ? config.motivo : 'Sin dato en este periodo.')}</p>
        <p class="metrica-pie">No puntúa y no cuenta como cero.</p>
      </article>
    );
  }
  return (
    <article class="metrica tarjeta">
      {cabeza}
      <p class="bruto">
        {bruto.principal}
        <small>{bruto.secundario}</small>
      </p>
      <div class="percentiles">
        {metrica.percentil === null ? (
          <p class="muted">Sin percentil: periodo insuficiente.</p>
        ) : (
          <p class="percentil">
            <span>Percentil en la Cámara</span>
            <span class="cifra">{num(metrica.percentil, 1)}</span>
            <Medidor valor={metrica.percentil} />
          </p>
        )}
        {metrica.percentil_grupo === null ? null : (
          <p class="percentil grupo">
            <span>
              Percentil en su grupo
              {metrica.n_grupo === null
                ? ''
                : ` (${num(metrica.n_grupo)} ${plural(metrica.n_grupo, 'diputado', 'diputados')})`}
            </span>
            <span class="cifra">{num(metrica.percentil_grupo, 1)}</span>
            <Medidor valor={metrica.percentil_grupo} />
          </p>
        )}
      </div>
      {serie ? <Evolucion valores={serie} meses={ficha.evolucion.meses} config={config} /> : null}
      {metrica.fuente ? (
        <p class="metrica-pie">
          <a href={metrica.fuente.url} rel="noopener">
            Ver fuente
          </a>
          : {metrica.fuente.nombre}
          {metrica.fuente.fecha_dato ? `. Datos hasta el ${fechaLarga(metrica.fuente.fecha_dato)}.` : '.'}
        </p>
      ) : null}
    </article>
  );
}

function Periodos({ ficha }: { ficha: Ficha }) {
  const conDato = scoring.dimensiones.filter((dimension) =>
    scoring.metricas.some((m) => m.dimension === dimension.id && m.estado !== 'no_disponible'),
  );
  return (
    <section class="seccion" aria-labelledby="periodos-titulo">
      <h2 id="periodos-titulo">Por periodo</h2>
      <div class="tarjeta desborde">
        <table class="lista-tabla apilable">
          <thead>
            <tr>
              <th scope="col">Periodo</th>
              <th scope="col" class="num">
                Índice
              </th>
              <th scope="col">Posición</th>
              {conDato.map((dimension) => (
                <th scope="col" class="num">
                  {dimension.nombreCorto}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scoring.periodos.map((config) => {
              const periodo = ficha.periodos[config.id];
              if (!periodo || periodo.estado !== 'disponible') {
                return (
                  <tr>
                    <th scope="row">{config.nombre}</th>
                    <td class="muted" colSpan={2 + conDato.length}>
                      No disponible. {motivoPeriodo(periodo?.motivo)}
                    </td>
                  </tr>
                );
              }
              const puntuaciones = new Map((periodo.dimensiones ?? []).map((d) => [d.id, d.puntuacion]));
              return (
                <tr>
                  <th scope="row">
                    {config.nombre}
                    {periodo.desde && periodo.hasta ? (
                      <span class="secundario">
                        {fechaCorta(periodo.desde)} – {fechaCorta(periodo.hasta)}
                      </span>
                    ) : null}
                  </th>
                  <td class="num" data-label="Índice">
                    {periodo.indice == null ? 'No disponible' : num(periodo.indice, scoring.decimales)}
                  </td>
                  <td data-label="Posición">
                    {periodo.situacion === 'ranking' && periodo.posicion != null
                      ? `N.º ${num(periodo.posicion)} de ${num(periodo.total_ranking ?? 0)}`
                      : periodo.situacion === 'gobierno'
                        ? 'Fuera del ranking: Gobierno'
                        : 'Periodo insuficiente'}
                  </td>
                  {conDato.map((dimension) => {
                    const puntuacion = puntuaciones.get(dimension.id);
                    return (
                      <td class="num" data-label={dimension.nombreCorto}>
                        {puntuacion == null ? 'No disponible' : num(puntuacion, scoring.decimales)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FilaCargo({ cargo }: { cargo: Ficha['cargos'][number] }) {
  return (
    <tr>
      <th scope="row">{cargo.organo}</th>
      <td data-label="Cargo">{cargo.cargo}</td>
      <td class="fecha" data-label="Fechas">
        {fechaCorta(cargo.desde)} – {cargo.hasta ? fechaCorta(cargo.hasta) : 'actualidad'}
      </td>
    </tr>
  );
}

function Cargos({ ficha }: { ficha: Ficha }) {
  if (ficha.cargos.length === 0) return null;
  const cabecera = (
    <thead>
      <tr>
        <th scope="col">Órgano</th>
        <th scope="col">Cargo</th>
        <th scope="col">Fechas</th>
      </tr>
    </thead>
  );
  const resto = ficha.cargos.slice(VISIBLES);
  return (
    <section class="seccion" aria-labelledby="cargos-titulo">
      <h2 id="cargos-titulo">Cargos en órganos de la Cámara</h2>
      <p class="nota">Tal como constan en los datos oficiales, con la denominación del Congreso.</p>
      <div class="tarjeta">
        <table class="lista-tabla apilable">
          {cabecera}
          <tbody>
            {ficha.cargos.slice(0, VISIBLES).map((cargo) => (
              <FilaCargo cargo={cargo} />
            ))}
          </tbody>
        </table>
        {resto.length > 0 ? (
          <details class="mas">
            <summary>
              Ver {num(resto.length)} {plural(resto.length, 'cargo más', 'cargos más')}
            </summary>
            <table class="lista-tabla apilable">
              <caption class="sr">Resto de cargos</caption>
              {cabecera}
              <tbody>
                {resto.map((cargo) => (
                  <FilaCargo cargo={cargo} />
                ))}
              </tbody>
            </table>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function Votaciones({ ficha }: { ficha: Ficha }) {
  return (
    <section class="seccion" aria-labelledby="votaciones-titulo">
      <h2 id="votaciones-titulo">Últimas votaciones</h2>
      {ficha.ultimas_votaciones.length === 0 ? (
        <p class="nota">No figura en ninguna votación nominal del periodo.</p>
      ) : (
        <div class="tarjeta">
          <table class="lista-tabla apilable">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Asunto</th>
                <th scope="col">Voto</th>
                <th scope="col">Fuente</th>
              </tr>
            </thead>
            <tbody>
              {ficha.ultimas_votaciones.map((votacion) => (
                <tr>
                  <td class="fecha">{votacion.fecha ? fechaCorta(votacion.fecha) : 'Sin fecha'}</td>
                  <td>
                    {recortar(votacion.titulo ?? votacion.asunto ?? 'Sin título', 200)}
                    {votacion.titulo && votacion.asunto ? (
                      <span class="secundario">{recortar(votacion.asunto, 240)}</span>
                    ) : null}
                  </td>
                  <td>
                    <span class={`voto ${votacion.sentido}`}>{sentidoVoto(votacion.sentido)}</span>
                    {votacion.telematico ? <span class="secundario">Telemático</span> : null}
                  </td>
                  <td class="enlaces">
                    {votacion.url_fuente ? (
                      <a href={votacion.url_fuente} rel="noopener">
                        Datos<span class="sr"> oficiales de la sesión del {fechaCorta(votacion.fecha ?? '')}</span>
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Intervenciones({ ficha }: { ficha: Ficha }) {
  return (
    <section class="seccion" aria-labelledby="intervenciones-titulo">
      <h2 id="intervenciones-titulo">Últimas intervenciones</h2>
      {ficha.ultimas_intervenciones.length === 0 ? (
        <p class="nota">Sin intervenciones registradas en los datos oficiales.</p>
      ) : (
        <div class="tarjeta">
          <table class="lista-tabla apilable">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Órgano y asunto</th>
                <th scope="col">Originales</th>
              </tr>
            </thead>
            <tbody>
              {ficha.ultimas_intervenciones.map((intervencion) => (
                <tr>
                  <td class="fecha">{fechaCorta(intervencion.fecha)}</td>
                  <td>
                    {intervencion.organo}
                    {intervencion.tipo_iniciativa ? (
                      <span class="secundario">{intervencion.tipo_iniciativa.replace(/\.$/, '')}</span>
                    ) : null}
                    {intervencion.cuenta ? null : (
                      <span class="secundario">
                        <span class="etiqueta rayada">No puntúa</span> {motivoExclusion(intervencion.motivo_exclusion)}
                      </span>
                    )}
                  </td>
                  <td class="enlaces">
                    {intervencion.url_fuente ? (
                      <a href={intervencion.url_fuente} rel="noopener">
                        Texto<span class="sr"> de la intervención del {fechaCorta(intervencion.fecha)}</span>
                      </a>
                    ) : null}
                    <a href={intervencion.url_video} rel="noopener">
                      Vídeo<span class="sr"> de la intervención del {fechaCorta(intervencion.fecha)}</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function FichaDiputado({ ficha }: { ficha: Ficha }) {
  const principal = periodoPrincipal(ficha, ORDEN_PERIODOS);
  return (
    <>
      <p class="miga">
        <a href="/">← Ranking</a>
      </p>
      <Cabecera ficha={ficha} periodo={principal?.periodo} />
      {principal ? (
        <>
          <div class="ficha-rejilla">
            <Indice ficha={ficha} id={principal.id} periodo={principal.periodo} />
            <Dimensiones periodo={principal.periodo} />
          </div>
          <section class="seccion" aria-labelledby="metricas-titulo">
            <h2 id="metricas-titulo">Métricas</h2>
            <p class="nota">
              Cada métrica muestra el dato oficial y su percentil: el porcentaje de diputados con un valor inferior (50
              es la mediana). El percentil dentro del grupo es contexto y no puntúa.
            </p>
            <div class="metricas">
              {(principal.periodo.metricas ?? []).map((metrica) => (
                <TarjetaMetrica metrica={metrica} ficha={ficha} />
              ))}
            </div>
          </section>
        </>
      ) : (
        <p class="aviso">
          <span>No hay ningún periodo con datos para este diputado.</span>
        </p>
      )}
      <Periodos ficha={ficha} />
      <Cargos ficha={ficha} />
      <Votaciones ficha={ficha} />
      <Intervenciones ficha={ficha} />
    </>
  );
}
