/**
 * Profile of a deputy (decision D-038): the index and its dimensions first, everything
 * else a tap away. Rendered at build time and readable without JavaScript: the
 * sections follow one another, what is folded is a <details> and the period switch is
 * CSS. A small script (ficha-client.ts) turns the section links into tabs and makes
 * the monthly charts answer to the pointer.
 */
import type { ComponentChildren } from 'preact';
import { groups } from '../../../config/parties.ts';
import { scoring, type MetricConfig } from '../../../config/scoring.ts';
import type { Ficha, FichaPeriodo, Metrica } from '../lib/data.ts';
import {
  codificarSerie,
  intervalo,
  periodoPrincipal,
  recortar,
  resumenEvolucion,
  resumenFicha,
  serieDelPeriodo,
  valorBruto,
  type Principal,
} from '../lib/ficha.ts';
import {
  duracion,
  fechaCorta,
  iniciales,
  mes,
  motivoExclusion,
  nombreCircunscripcion,
  num,
  plural,
  porcentaje,
  rolEtiqueta,
  sentidoVoto,
} from '../lib/format.ts';
import { sparkBars } from '../lib/sparkline.ts';
import { Medidor, PuntoGrupo, Termino } from './parts.tsx';

const ORDEN_PERIODOS = scoring.periodos.map((periodo) => periodo.id);
const ESTADO_ETIQUETA = {
  observado: 'Dato oficial directo',
  calculado: 'Indicador derivado',
  no_disponible: '',
} as const;
/** Rows of a list shown before the rest is folded. */
const VISIBLES = 5;
/** Names of the metrics that score with the percentile inside the group. */
const comparadasEnGrupo: string[] = scoring.metricas
  .filter((metrica) => 'comparacion' in metrica && metrica.comparacion === 'grupo')
  .map((metrica) => metrica.nombre);

function grupoDe(id: string) {
  return groups.find((group) => group.code === id);
}

function Cabecera({ ficha, principal }: { ficha: Ficha; principal: Principal | undefined }) {
  const { diputado } = ficha;
  const grupo = grupoDe(diputado.grupo.id);
  const roles = (principal?.periodo.roles ?? []).filter((rol) => rol !== 'gobierno');
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
          <span>{nombreCircunscripcion(diputado.circunscripcion)}</span>
          <span>Candidatura: {diputado.partido}</span>
        </p>
        <p class="ficha-datos">
          Escaño: {fechaCorta(diputado.fecha_alta)} – {diputado.fecha_baja ? fechaCorta(diputado.fecha_baja) : 'hoy'}
        </p>
      </div>
      <p class="ficha-resumen">{resumenFicha(ficha, principal)}</p>
      <div class="ficha-extra">
        {roles.length > 0 || ficha.gobierno.length > 0 ? (
          <span class="etiquetas">
            {roles.map((rol) => (
              <span class="etiqueta">{rolEtiqueta(rol)}</span>
            ))}
            {ficha.gobierno.length > 0 ? <span class="etiqueta">Etapa en el Gobierno</span> : null}
          </span>
        ) : null}
        <a href={diputado.url_ficha_oficial} rel="noopener">
          Ficha oficial<span class="sr"> en congreso.es</span>
        </a>
        <a href={`/comparar?d=${diputado.slug}`}>Comparar</a>
      </div>
    </header>
  );
}

/**
 * One switch for the whole profile; the checked radio decides which period shows (CSS).
 * Only the periods with data are offered, in the order the panels are numbered.
 */
function SelectorPeriodo({ ids, inicial }: { ids: readonly string[]; inicial: string }) {
  return (
    <fieldset class="segmento selector-periodo">
      <legend class="sr">Periodo</legend>
      <div class="segmento-opciones">
        {ids.map((id) => (
          <label>
            <input type="radio" name="ficha-periodo" value={id} checked={id === inicial} />
            {scoring.periodos.find((config) => config.id === id)?.nombre ?? id}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Indice({ ficha, id, periodo }: { ficha: Ficha; id: string; periodo: FichaPeriodo }) {
  const nombrePeriodo = scoring.periodos.find((p) => p.id === id)?.nombre ?? id;
  const dimensiones = periodo.dimensiones ?? [];
  const conDato = dimensiones.filter((d) => d.puntuacion !== null).length;
  const minimo = scoring.poblacionReferencia.diasMinimos;
  const enRanking = periodo.situacion === 'ranking';
  return (
    <section class="bloque tarjeta indice" aria-labelledby={`indice-${id}`}>
      <h3 id={`indice-${id}`}>Índice de actividad</h3>
      <p class="muted">
        {nombrePeriodo}
        {periodo.desde && periodo.hasta ? ` · ${fechaCorta(periodo.desde)} – ${fechaCorta(periodo.hasta)}` : ''}
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
      {enRanking && periodo.indice == null ? <p class="indice-fuera">Sin índice</p> : null}
      {periodo.situacion === 'gobierno' ? (
        <>
          <p class="indice-fuera">Fuera del ranking</p>
          <p class="indice-nota">Miembro del Gobierno: su actividad no se compara con la del resto.</p>
        </>
      ) : null}
      {periodo.situacion === 'periodo_insuficiente' ? (
        <>
          <p class="indice-fuera">Sin índice</p>
          <p class="indice-nota">
            {num(periodo.dias_evaluados ?? 0)} {plural(periodo.dias_evaluados ?? 0, 'día', 'días')} en activo; hacen
            falta {minimo}.
          </p>
        </>
      ) : null}
      <details class="plegable">
        <summary>Cómo leer este índice</summary>
        <div class="plegable-cuerpo">
          {periodo.cobertura != null ? (
            <p>
              <Termino id="cobertura">Cobertura</Termino> del {porcentaje(periodo.cobertura, 0)}: se calcula con{' '}
              {conDato} de las {dimensiones.length} dimensiones. Las que no tienen fuente oficial no cuentan como cero.
            </p>
          ) : null}
          {enRanking && periodo.indice == null ? (
            <p>
              No hay datos suficientes: hace falta al menos un {porcentaje(scoring.coberturaMinima, 0)} de cobertura.
            </p>
          ) : null}
          {periodo.situacion === 'gobierno' ? (
            <p>
              Fue miembro del Gobierno durante la mayor parte del periodo, así que no tiene posición.
              {periodo.indice != null
                ? ` Como referencia, con las mismas reglas su índice sería ${num(periodo.indice, scoring.decimales)} de 100.`
                : ''}
            </p>
          ) : null}
          {periodo.situacion === 'periodo_insuficiente' ? (
            <p>Con menos de {minimo} días no se calculan percentiles. Se muestran sus cifras brutas.</p>
          ) : null}
          {periodo.etapa_gobierno_excluida ? (
            <p>
              No se evalúan los {num(periodo.dias_gobierno ?? 0)} días en que fue miembro del Gobierno: el índice cubre
              los {num(periodo.dias_evaluados ?? 0)} restantes.
            </p>
          ) : null}
          {ficha.gobierno.map((etapa) => (
            <p>
              {etapa.cargos}, {intervalo(etapa.desde, etapa.hasta)}. Fuente: BOE, {etapa.evidencia.join('; ')}.
            </p>
          ))}
          <p>
            Mide cantidad de actividad registrada, no su calidad. <a href="/metodologia">Metodología</a>
          </p>
        </div>
      </details>
    </section>
  );
}

function Dimensiones({ id, periodo }: { id: string; periodo: FichaPeriodo }) {
  const puntuaciones = new Map((periodo.dimensiones ?? []).map((d) => [d.id, d.puntuacion]));
  return (
    <section class="bloque tarjeta" aria-labelledby={`dimensiones-${id}`}>
      <h3 id={`dimensiones-${id}`}>Dimensiones</h3>
      <ul class="dimensiones">
        {scoring.dimensiones.map((dimension) => {
          const puntuacion = puntuaciones.get(dimension.id) ?? null;
          return (
            <li class={puntuacion === null ? 'dimension sin-dato' : 'dimension'} title={dimension.descripcion}>
              <div class="dimension-cabeza">
                <span class="nombre">{dimension.nombre}</span>
                {puntuacion === null ? (
                  <span class="valor">No disponible</span>
                ) : (
                  <span class="valor">{num(puntuacion, scoring.decimales)}</span>
                )}
              </div>
              {puntuacion === null ? <Medidor valor={0} /> : <Medidor valor={puntuacion} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

interface EvolucionProps {
  valores: (number | null)[];
  meses: string[];
  config: MetricConfig;
}

/**
 * Monthly columns. The values travel in data attributes so that the script can say
 * which month is under the pointer; without it, the line below gives the peak.
 */
function Evolucion({ valores, meses, config }: EvolucionProps) {
  if (meses.length < 2) return null;
  const ancho = meses.length * 8;
  const alto = 40;
  const proporcion = config.unidad === 'proporcion';
  const barras = sparkBars(valores, meses, {
    width: ancho,
    height: alto,
    ...(proporcion ? { max: 1, marcarCeros: true } : {}),
  });
  const resumen = resumenEvolucion(valores, meses, config);
  return (
    <figure class="evolucion">
      <svg
        class="chispa"
        viewBox={`0 0 ${ancho} ${alto}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={resumen}
        data-inicio={meses[0]}
        data-valores={codificarSerie(valores)}
        data-unidad={config.unidad}
        data-uno={config.objeto[0]}
        data-varios={config.objeto[1]}
      >
        {barras.map((barra) => (
          <rect x={barra.x} y={barra.y} width={barra.width} height={barra.height} />
        ))}
        <line class="base" x1="0" y1={alto} x2={ancho} y2={alto} />
      </svg>
      <figcaption>
        <span>{mes(meses[0] ?? '', true)}</span>
        <span class="chispa-lectura">{resumen.replace(/^Evolución mensual de .*?: /, '').replace(/\.$/, '')}</span>
        <span>{mes(meses[meses.length - 1] ?? '', true)}</span>
      </figcaption>
    </figure>
  );
}

/** True when the metric scores with the percentile inside the group (D-034). */
function porGrupo(metrica: Metrica, config: MetricConfig): boolean {
  return (metrica.comparacion ?? ('comparacion' in config ? config.comparacion : 'camara')) === 'grupo';
}

/**
 * The two percentiles of a metric. The one that enters the score goes first, with the
 * strong meter; the other one is context.
 */
function Percentiles({ metrica, porGrupo }: { metrica: Metrica; porGrupo: boolean }) {
  const grupo =
    metrica.percentil_grupo === null
      ? null
      : {
          etiqueta: `Percentil en su grupo${
            metrica.n_grupo === null
              ? ''
              : ` (${num(metrica.n_grupo)} ${plural(metrica.n_grupo, 'diputado', 'diputados')})`
          }`,
          valor: metrica.percentil_grupo,
        };
  const camara = metrica.percentil === null ? null : { etiqueta: 'Percentil en la Cámara', valor: metrica.percentil };
  const [principal, secundario] = porGrupo ? [grupo, camara] : [camara, grupo];
  return (
    <div class="percentiles">
      {principal === null ? (
        <p class="muted">Sin percentil: periodo insuficiente.</p>
      ) : (
        <p class="percentil">
          <span>
            {principal.etiqueta}
            <strong class="puntua"> · puntúa</strong>
          </span>
          <span class="cifra">{num(principal.valor, 1)}</span>
          <Medidor valor={principal.valor} />
        </p>
      )}
      {secundario === null ? null : (
        <p class="percentil grupo">
          <span>{secundario.etiqueta} · referencia</span>
          <span class="cifra">{num(secundario.valor, 1)}</span>
          <Medidor valor={secundario.valor} />
        </p>
      )}
    </div>
  );
}

interface MetricaProps {
  metrica: Metrica;
  config: MetricConfig;
  ficha: Ficha;
  periodo: FichaPeriodo;
}

/** One line per metric: name, official figure and the percentile that scores. A tap opens the rest. */
function LineaMetrica({ metrica, config, ficha, periodo }: MetricaProps) {
  const bruto = valorBruto(metrica, config);
  if (!bruto) return null;
  const enGrupo = porGrupo(metrica, config);
  const percentil = enGrupo ? metrica.percentil_grupo : metrica.percentil;
  const completa = ficha.evolucion.series[metrica.id];
  const serie = completa ? serieDelPeriodo(completa, ficha.evolucion.meses, periodo.desde, periodo.hasta) : undefined;
  return (
    <li>
      <details class="linea">
        <summary>
          <span class="m-nombre">{config.nombre}</span>
          <span class="m-bruto">{bruto.principal}</span>
          <span class="m-percentil">
            {percentil === null ? (
              <span class="nd">
                <span aria-hidden="true">—</span>
                <span class="sr">Sin percentil</span>
              </span>
            ) : (
              <>
                <span class="cifra">
                  <span class="sr">Percentil </span>
                  {num(percentil, 0)}
                </span>
                <Medidor valor={percentil} />
              </>
            )}
          </span>
        </summary>
        <div class="linea-cuerpo">
          <p class="m-secundario">{bruto.secundario}</p>
          <Percentiles metrica={metrica} porGrupo={enGrupo} />
          {serie ? <Evolucion valores={serie.valores} meses={serie.meses} config={config} /> : null}
          {metrica.fuente ? (
            <p class="linea-pie">
              <a href={metrica.fuente.url} rel="noopener">
                Fuente<span class="sr">: {metrica.fuente.nombre}</span>
              </a>
              {ESTADO_ETIQUETA[metrica.estado] ? ` · ${ESTADO_ETIQUETA[metrica.estado]}` : ''}
              {metrica.fuente.fecha_dato ? ` · Datos hasta el ${fechaCorta(metrica.fuente.fecha_dato)}` : ''}
            </p>
          ) : null}
        </div>
      </details>
    </li>
  );
}

/** Speaking time: context next to the debate metrics, never part of the score. */
function LineaTiempo({ periodo }: { periodo: FichaPeriodo }) {
  const tiempo = periodo.tiempo_palabra;
  const contexto = scoring.contexto.find((item) => item.id === 'tiempo_palabra');
  if (!tiempo || !contexto) return null;
  const conHora = Math.max(1, tiempo.intervenciones - tiempo.sin_hora);
  return (
    <li>
      <details class="linea contexto">
        <summary>
          <span class="m-nombre">{contexto.nombre}</span>
          <span class="m-bruto">{duracion(tiempo.minutos)}</span>
          <span class="m-percentil">
            <span class="etiqueta rayada">No puntúa</span>
          </span>
        </summary>
        <div class="linea-cuerpo">
          <p class="m-secundario">
            En {num(tiempo.intervenciones)} {plural(tiempo.intervenciones, 'intervención', 'intervenciones')}
            {tiempo.intervenciones > 0 ? `, ${num(tiempo.minutos / conHora, 1)} minutos de media` : ''}
            {tiempo.sin_hora > 0
              ? `. ${num(tiempo.sin_hora)} ${plural(tiempo.sin_hora, 'no tiene', 'no tienen')} hora oficial y no ${plural(tiempo.sin_hora, 'suma', 'suman')}`
              : ''}
            .
          </p>
          <p class="linea-pie">{contexto.calculo}</p>
        </div>
      </details>
    </li>
  );
}

/** Metrics without a value: one line for all of them, with the reasons folded. */
function SinDato({ metricas }: { metricas: { metrica: Metrica; config: MetricConfig }[] }) {
  if (metricas.length === 0) return null;
  return (
    <details class="linea sin-dato">
      <summary>
        <span class="m-nombre">
          {num(metricas.length)} {plural(metricas.length, 'métrica', 'métricas')} sin dato
        </span>
        <span class="m-bruto">
          No {plural(metricas.length, 'puntúa', 'puntúan')} y no {plural(metricas.length, 'cuenta', 'cuentan')} como
          cero
        </span>
      </summary>
      <div class="linea-cuerpo">
        <ul class="motivos">
          {metricas.map(({ metrica, config }) => (
            <li>
              <strong>{config.nombre}.</strong>{' '}
              {metrica.motivo ?? ('motivo' in config ? config.motivo : 'Sin dato en este periodo.')}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

function Actividad({ ficha, periodo }: { ficha: Ficha; periodo: FichaPeriodo }) {
  const puntuaciones = new Map((periodo.dimensiones ?? []).map((d) => [d.id, d.puntuacion]));
  const todas = (periodo.metricas ?? []).flatMap((metrica) => {
    const config = scoring.metricas.find((m) => m.id === metrica.id);
    return config ? [{ metrica, config }] : [];
  });
  const conDato = todas.filter(({ metrica, config }) => valorBruto(metrica, config) !== undefined);
  const sinDato = todas.filter(({ metrica, config }) => valorBruto(metrica, config) === undefined);
  return (
    <>
      {scoring.dimensiones.map((dimension) => {
        const suyas = conDato.filter(({ config }) => config.dimension === dimension.id);
        if (suyas.length === 0) return null;
        const puntuacion = puntuaciones.get(dimension.id) ?? null;
        return (
          <div class="grupo-dimension tarjeta">
            <h3>
              <span>{dimension.nombre}</span>
              {puntuacion === null ? null : (
                <span class="valor">
                  <span class="sr">Puntuación </span>
                  {num(puntuacion, scoring.decimales)}
                </span>
              )}
            </h3>
            <ul class="metricas-lista">
              {suyas.map(({ metrica, config }) => (
                <LineaMetrica metrica={metrica} config={config} ficha={ficha} periodo={periodo} />
              ))}
              {dimension.id === 'debates' ? <LineaTiempo periodo={periodo} /> : null}
            </ul>
          </div>
        );
      })}
      <SinDato metricas={sinDato} />
    </>
  );
}

interface ListaProps<T> {
  filas: readonly T[];
  cabecera: ComponentChildren;
  fila: (item: T) => ComponentChildren;
  /** "votación más" / "votaciones más", for the label of the folded rest. */
  resto: readonly [string, string];
  titulo: string;
}

/** A table that shows its first rows and folds the rest. */
function Lista<T>({ filas, cabecera, fila, resto, titulo }: ListaProps<T>) {
  const ocultas = filas.slice(VISIBLES);
  return (
    <div class="tarjeta">
      <table class="lista-tabla apilable">
        <caption class="sr">{titulo}</caption>
        {cabecera}
        <tbody>{filas.slice(0, VISIBLES).map(fila)}</tbody>
      </table>
      {ocultas.length > 0 ? (
        <details class="mas">
          <summary>
            Ver {num(ocultas.length)} {plural(ocultas.length, resto[0], resto[1])}
          </summary>
          <table class="lista-tabla apilable">
            <caption class="sr">{titulo}: resto</caption>
            {cabecera}
            <tbody>{ocultas.map(fila)}</tbody>
          </table>
        </details>
      ) : null}
    </div>
  );
}

function Ponencias({ ficha }: { ficha: Ficha }) {
  if (ficha.ponencias.length === 0) return null;
  const aprobadas = ficha.ponencias.filter((ley) => ley.resultado?.startsWith('Aprobado')).length;
  return (
    <div class="subseccion">
      <h3>
        Ponencias de leyes
        <span class="muted">
          {' '}
          · {num(ficha.ponencias.length)}, {num(aprobadas)} {plural(aprobadas, 'aprobada', 'aprobadas')}
        </span>
      </h3>
      <Lista
        filas={ficha.ponencias}
        titulo="Leyes de las que fue ponente"
        resto={['ley más', 'leyes más']}
        cabecera={
          <thead>
            <tr>
              <th scope="col">Ley</th>
              <th scope="col">Resultado</th>
            </tr>
          </thead>
        }
        fila={(ley) => (
          <tr>
            <th scope="row">
              <a href={ley.url_fuente} rel="noopener">
                {recortar(ley.titulo, 160)}
              </a>
            </th>
            <td data-label="Resultado">
              {ley.resultado ?? 'En tramitación'}
              {ley.fecha_resultado ? <span class="secundario">{fechaCorta(ley.fecha_resultado)}</span> : null}
            </td>
          </tr>
        )}
      />
    </div>
  );
}

function Cargos({ ficha }: { ficha: Ficha }) {
  return (
    <Lista
      filas={ficha.cargos}
      titulo="Cargos en órganos de la Cámara"
      resto={['cargo más', 'cargos más']}
      cabecera={
        <thead>
          <tr>
            <th scope="col">Órgano</th>
            <th scope="col">Cargo</th>
            <th scope="col">Fechas</th>
          </tr>
        </thead>
      }
      fila={(cargo) => (
        <tr>
          <th scope="row">{cargo.organo}</th>
          <td data-label="Cargo">{cargo.cargo}</td>
          <td class="fecha" data-label="Fechas">
            {fechaCorta(cargo.desde)} – {cargo.hasta ? fechaCorta(cargo.hasta) : 'actualidad'}
          </td>
        </tr>
      )}
    />
  );
}

function Votaciones({ ficha }: { ficha: Ficha }) {
  if (ficha.ultimas_votaciones.length === 0) {
    return <p class="nota">No figura en ninguna votación nominal.</p>;
  }
  return (
    <Lista
      filas={ficha.ultimas_votaciones}
      titulo="Últimas votaciones"
      resto={['votación más', 'votaciones más']}
      cabecera={
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Asunto</th>
            <th scope="col">Voto</th>
            <th scope="col">Fuente</th>
          </tr>
        </thead>
      }
      fila={(votacion) => (
        <tr>
          <td class="fecha">{votacion.fecha ? fechaCorta(votacion.fecha) : 'Sin fecha'}</td>
          <td>{recortar(votacion.titulo ?? votacion.asunto ?? 'Sin título', 140)}</td>
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
      )}
    />
  );
}

function Intervenciones({ ficha }: { ficha: Ficha }) {
  if (ficha.ultimas_intervenciones.length === 0) {
    return <p class="nota">Sin intervenciones registradas.</p>;
  }
  return (
    <Lista
      filas={ficha.ultimas_intervenciones}
      titulo="Últimas intervenciones"
      resto={['intervención más', 'intervenciones más']}
      cabecera={
        <thead>
          <tr>
            <th scope="col">Fecha</th>
            <th scope="col">Órgano y asunto</th>
            <th scope="col">Originales</th>
          </tr>
        </thead>
      }
      fila={(intervencion) => (
        <tr>
          <td class="fecha">{fechaCorta(intervencion.fecha)}</td>
          <td>
            {intervencion.organo}
            {intervencion.tipo_iniciativa ? (
              <span class="secundario">{intervencion.tipo_iniciativa.replace(/\.$/, '')}</span>
            ) : null}
            {intervencion.cuenta ? null : intervencion.motivo_exclusion === 'pregunta_oral' ? (
              <span class="secundario">
                <span class="etiqueta">{motivoExclusion(intervencion.motivo_exclusion)}</span>
              </span>
            ) : (
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
      )}
    />
  );
}

export function FichaDiputado({ ficha }: { ficha: Ficha }) {
  const principal = periodoPrincipal(ficha, ORDEN_PERIODOS);
  const nombre = `${ficha.diputado.nombre} ${ficha.diputado.apellidos}`;
  /** Periods with data, numbered in the order of the switch, which the CSS goes by. */
  const disponibles = scoring.periodos
    .flatMap((config) => {
      const periodo = ficha.periodos[config.id];
      return periodo?.estado === 'disponible' ? [{ id: config.id, periodo }] : [];
    })
    .map((item, i) => ({ ...item, clase: `per per-${i + 1}` }));
  const secciones = [
    { id: 'resumen', nombre: 'Resumen' },
    { id: 'actividad', nombre: 'Actividad' },
    { id: 'votaciones', nombre: 'Votaciones' },
    { id: 'intervenciones', nombre: 'Intervenciones' },
    ...(ficha.cargos.length > 0 ? [{ id: 'cargos', nombre: 'Cargos' }] : []),
  ];
  return (
    <div class="ficha">
      <p class="miga">
        <a href="/">← Ranking</a>
      </p>
      <Cabecera ficha={ficha} principal={principal} />
      {disponibles.length > 1 && principal ? (
        <SelectorPeriodo ids={disponibles.map((item) => item.id)} inicial={principal.id} />
      ) : null}
      <nav class="pestanas" aria-label="Secciones de la ficha">
        <ul>
          {secciones.map((seccion) => (
            <li>
              <a href={`#${seccion.id}`}>{seccion.nombre}</a>
            </li>
          ))}
        </ul>
      </nav>

      <section class="panel" id="resumen" aria-labelledby="resumen-titulo">
        <h2 id="resumen-titulo" class="sr">
          Índice de actividad de {nombre}
        </h2>
        {disponibles.length === 0 ? (
          <p class="aviso">
            <span>No hay ningún periodo con datos para este diputado.</span>
          </p>
        ) : null}
        {disponibles.map(({ id, clase, periodo }) => (
          <div class={`${clase} ficha-rejilla`}>
            <Indice ficha={ficha} id={id} periodo={periodo} />
            <Dimensiones id={id} periodo={periodo} />
          </div>
        ))}
      </section>

      <section class="panel" id="actividad" aria-labelledby="actividad-titulo">
        <h2 id="actividad-titulo">Actividad de {nombre}</h2>
        <details class="plegable">
          <summary>Cómo leer estas cifras</summary>
          <div class="plegable-cuerpo">
            <p>
              Cada línea da el dato oficial y su percentil: el porcentaje de diputados con un valor inferior (50 es la
              mediana). Puntúa el percentil en la Cámara
              {comparadasEnGrupo.length > 0
                ? `, salvo en ${comparadasEnGrupo.map((nombre) => `«${nombre}»`).join(' y ')}, que se compara dentro del grupo`
                : ''}
              . <a href="/metodologia">Metodología</a>
            </p>
          </div>
        </details>
        <p class="leyenda-metricas">
          <span>Dato oficial</span>
          <Termino id="percentil">Percentil</Termino>
        </p>
        {disponibles.map(({ clase, periodo }) => (
          <div class={`${clase} actividad`}>
            <Actividad ficha={ficha} periodo={periodo} />
          </div>
        ))}
        <Ponencias ficha={ficha} />
      </section>

      <section class="panel" id="votaciones" aria-labelledby="votaciones-titulo">
        <h2 id="votaciones-titulo">Últimas votaciones de {nombre}</h2>
        <Votaciones ficha={ficha} />
      </section>

      <section class="panel" id="intervenciones" aria-labelledby="intervenciones-titulo">
        <h2 id="intervenciones-titulo">Últimas intervenciones de {nombre}</h2>
        <Intervenciones ficha={ficha} />
      </section>

      {ficha.cargos.length > 0 ? (
        <section class="panel" id="cargos" aria-labelledby="cargos-titulo">
          <h2 id="cargos-titulo">Cargos de {nombre} en la Cámara</h2>
          <Cargos ficha={ficha} />
        </section>
      ) : null}
    </div>
  );
}
