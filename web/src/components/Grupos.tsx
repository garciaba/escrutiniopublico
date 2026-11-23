/**
 * Pieces of the /grupos page (decision D-037): how the index of the deputies of each
 * group is spread, each metric group by group, and the table by electoral list.
 * Rendered only at build time; the page ships no JavaScript.
 */
import { scoring, type MetricConfig } from '../../../config/scoring.ts';
import type { Agregado } from '../lib/data.ts';
import { num } from '../lib/format.ts';
import {
  anchoBarra,
  escala,
  fueraDelCalculo,
  nDiputados,
  resumenDistribucion,
  unidadAgregada,
  valorAgregado,
} from '../lib/grupos.ts';
import { Medidor, PuntoGrupo } from './parts.tsx';

const MINIMO_BANDA = scoring.agregados.minimoDistribucion;
const ESTADO_ETIQUETA = { observado: 'Observado', calculado: 'Calculado', no_disponible: 'No disponible' } as const;
/** Why the metric scored inside each group is shown here as a plain figure. */
const REGLA_PONENCIAS = scoring.agregados.reglas.find((regla) => regla.id === 'ponencias')?.texto ?? '';

export interface Persona {
  nombre: string;
  indice: number;
}

export interface FilaGrupo {
  agregado: Agregado;
  /** Colour of the dot; parliamentary groups only. */
  color?: string;
  /** Ranking filtered by this group or list. */
  href?: string;
  personas: readonly Persona[];
}

const pct = (value: number) => `${Math.max(0, Math.min(100, value))}%`;

function NoDisponible() {
  return (
    <span class="nd">
      <span aria-hidden="true">—</span>
      <span class="sr">No disponible</span>
    </span>
  );
}

/** Name of a group with its dot. `enlace` links it to the ranking filtered by the group. */
function Nombre({ fila, enlace = true }: { fila: FilaGrupo; enlace?: boolean }) {
  const nombre = fila.agregado.nombre_corto;
  return (
    <>
      {fila.color ? <PuntoGrupo color={fila.color} /> : null}
      {enlace && fila.href ? <a href={fila.href}>{nombre}</a> : nombre}
    </>
  );
}

/** One strip: a tick per deputy, the central half of the group as a band and the median. */
function Franja({ fila, nombres }: { fila: FilaGrupo; nombres: boolean }) {
  const { indice, diputados } = fila.agregado;
  return (
    <svg class="dist-franja" role="img" aria-label={resumenDistribucion(fila.agregado, MINIMO_BANDA)}>
      {[25, 50, 75].map((guia) => (
        <line class="guia" x1={pct(guia)} x2={pct(guia)} y1="0" y2="100%" />
      ))}
      {indice && diputados >= MINIMO_BANDA ? (
        <rect class="banda" x={pct(indice.p25)} width={pct(indice.p75 - indice.p25)} y="18%" height="64%" rx="3" />
      ) : null}
      {fila.personas.map((persona) => (
        <line class="raya" x1={pct(persona.indice)} x2={pct(persona.indice)} y1="26%" y2="74%">
          {nombres ? (
            <title>
              {persona.nombre}: {num(persona.indice, scoring.decimales)}
            </title>
          ) : null}
        </line>
      ))}
      {indice ? <line class="mediana" x1={pct(indice.mediana)} x2={pct(indice.mediana)} y1="6%" y2="94%" /> : null}
    </svg>
  );
}

/** Strip chart: one row per group on a shared 0–100 axis, plus the whole Chamber. */
export function Distribucion({ filas, camara }: { filas: readonly FilaGrupo[]; camara: FilaGrupo }) {
  const fila = (item: FilaGrupo, referencia: boolean) => (
    <li class={referencia ? 'dist-fila camara' : 'dist-fila'}>
      <div class="dist-nombre">
        <span class="nombre">
          <Nombre fila={item} />
        </span>
        <span class="cuantos">{nDiputados(item.agregado.diputados)}</span>
      </div>
      <Franja fila={item} nombres={!referencia} />
      <div class="dist-mediana">
        {item.agregado.indice ? num(item.agregado.indice.mediana, scoring.decimales) : <NoDisponible />}
      </div>
    </li>
  );
  return (
    <figure class="dist tarjeta">
      <figcaption class="dist-clave">
        <span>
          <svg aria-hidden="true">
            <line class="raya" x1="30%" x2="30%" y1="15%" y2="85%" />
            <line class="raya" x1="50%" x2="50%" y1="15%" y2="85%" />
            <line class="raya" x1="62%" x2="62%" y1="15%" y2="85%" />
          </svg>
          Cada raya es un diputado
        </span>
        <span>
          <svg aria-hidden="true">
            <rect class="banda" x="5%" width="90%" y="10%" height="80%" rx="3" />
          </svg>
          La banda agrupa a la mitad central del grupo
        </span>
        <span>
          <svg aria-hidden="true">
            <line class="mediana" x1="50%" x2="50%" y1="5%" y2="95%" />
          </svg>
          La línea oscura es la mediana
        </span>
      </figcaption>
      <div class="dist-eje" aria-hidden="true">
        <span class="dist-eje-titulo">Índice de actividad</span>
        <svg class="dist-eje-svg">
          {[0, 25, 50, 75, 100].map((marca) => (
            <text x={pct(marca)} y="12" text-anchor={marca === 0 ? 'start' : marca === 100 ? 'end' : 'middle'}>
              {marca}
            </text>
          ))}
        </svg>
        <span class="dist-eje-mediana">Mediana</span>
      </div>
      <ol class="dist-filas">
        {filas.map((item) => fila(item, false))}
        {fila(camara, true)}
      </ol>
    </figure>
  );
}

/** The figures behind the strip chart, as a table. */
export function TablaDistribucion({ filas, camara }: { filas: readonly FilaGrupo[]; camara: FilaGrupo }) {
  const celda = (valor: number | undefined, etiqueta: string) => (
    <td class="num" data-label={etiqueta}>
      {valor === undefined ? <NoDisponible /> : num(valor, scoring.decimales)}
    </td>
  );
  const fila = (item: FilaGrupo) => {
    const { indice } = item.agregado;
    const fuera = fueraDelCalculo(item.agregado);
    return (
      <tr>
        <th scope="row">
          <Nombre fila={item} />
          {fuera ? <span class="secundario">Sin contar: {fuera}</span> : null}
        </th>
        <td class="num" data-label="Diputados">
          {num(item.agregado.diputados)}
        </td>
        {celda(indice?.min, 'Mínimo')}
        {celda(indice?.p25, 'Cuartil inferior')}
        {celda(indice?.mediana, 'Mediana')}
        {celda(indice?.p75, 'Cuartil superior')}
        {celda(indice?.max, 'Máximo')}
      </tr>
    );
  };
  return (
    <details class="mas dist-cifras tarjeta">
      <summary>Ver las cifras del gráfico</summary>
      <div class="desborde">
        <table class="lista-tabla apilable">
          <thead>
            <tr>
              <th scope="col">Grupo</th>
              {['Diputados', 'Mínimo', 'Cuartil inferior', 'Mediana', 'Cuartil superior', 'Máximo'].map((titulo) => (
                <th scope="col" class="num">
                  {titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map(fila)}
            {fila(camara)}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const valorDe = (agregado: Agregado, id: string) =>
  agregado.metricas.find((metrica) => metrica.id === id)?.valor ?? null;

/** Rows of a comparison card: every group on the same scale, the Chamber as the reference. */
function FilasComparadas({
  filas,
  camara,
  valor,
  formato,
  unidad,
}: {
  filas: readonly FilaGrupo[];
  camara: FilaGrupo;
  valor: (agregado: Agregado) => number | null;
  formato: (valor: number) => string;
  unidad: string;
}) {
  const max = escala(
    [...filas, camara].map((item) => valor(item.agregado)),
    unidad,
  );
  const fila = (item: FilaGrupo) => {
    const cifra = valor(item.agregado);
    return (
      <tr>
        <th scope="row">
          <Nombre fila={item} enlace={false} />
        </th>
        <td class="num">{cifra === null ? <NoDisponible /> : formato(cifra)}</td>
        <td class="barra">{cifra === null ? null : <Medidor valor={anchoBarra(cifra, max)} />}</td>
      </tr>
    );
  };
  return (
    <>
      <thead class="sr">
        <tr>
          <th scope="col">Grupo</th>
          <th scope="col">Valor</th>
          <th scope="col">Gráfico</th>
        </tr>
      </thead>
      <tbody>{filas.map(fila)}</tbody>
      <tfoot>{fila(camara)}</tfoot>
    </>
  );
}

function TarjetaMetrica({
  metrica,
  filas,
  camara,
}: {
  metrica: MetricConfig;
  filas: readonly FilaGrupo[];
  camara: FilaGrupo;
}) {
  const dimension = scoring.dimensiones.find((d) => d.id === metrica.dimension);
  const fuente = 'fuente' in metrica ? scoring.fuentes[metrica.fuente] : undefined;
  return (
    <article class="metrica tarjeta comp">
      <div class="metrica-cabeza">
        <div>
          <h3>{metrica.nombre}</h3>
          <p class="dim">{dimension?.nombre}</p>
        </div>
        <span class={metrica.estado === 'observado' ? 'etiqueta solida' : 'etiqueta'}>
          {ESTADO_ETIQUETA[metrica.estado]}
        </span>
      </div>
      <p class="comp-unidad">{unidadAgregada(metrica.unidad)}</p>
      <table class="comp-tabla">
        <caption class="sr">
          {metrica.nombre}, por grupo. {unidadAgregada(metrica.unidad)}.
        </caption>
        <FilasComparadas
          filas={filas}
          camara={camara}
          valor={(agregado) => valorDe(agregado, metrica.id)}
          formato={(valor) => valorAgregado(valor, metrica.unidad)}
          unidad={metrica.unidad}
        />
      </table>
      <p class="metrica-pie">
        {'comparacion' in metrica && metrica.comparacion === 'grupo' ? <>{REGLA_PONENCIAS} </> : null}
        {fuente ? (
          <>
            Fuente:{' '}
            <a href={fuente.url} rel="noopener">
              {fuente.nombre}
            </a>
          </>
        ) : null}
      </p>
    </article>
  );
}

/** One card per metric with data, plus the speaking time as context. */
export function TarjetasMetricas({ filas, camara }: { filas: readonly FilaGrupo[]; camara: FilaGrupo }) {
  const conDato = scoring.metricas.filter((metrica) => valorDe(camara.agregado, metrica.id) !== null);
  const contexto = scoring.contexto.find((item) => item.id === 'tiempo_palabra');
  return (
    <div class="metricas">
      {conDato.map((metrica) => (
        <TarjetaMetrica metrica={metrica} filas={filas} camara={camara} />
      ))}
      {contexto ? (
        <article class="metrica tarjeta comp contexto">
          <div class="metrica-cabeza">
            <div>
              <h3>{contexto.nombre}</h3>
              <p class="dim">Contexto de la participación en debates</p>
            </div>
            <span class="etiqueta rayada">No puntúa</span>
          </div>
          <p class="comp-unidad">Minutos por diputado, cada 100 días en activo</p>
          <table class="comp-tabla">
            <caption class="sr">{contexto.nombre}, por grupo. Minutos por diputado, cada 100 días en activo.</caption>
            <FilasComparadas
              filas={filas}
              camara={camara}
              valor={(agregado) => agregado.tiempo_palabra.minutos_por_100_dias}
              formato={(valor) => valorAgregado(valor, 'minutos')}
              unidad="minutos"
            />
          </table>
        </article>
      ) : null}
    </div>
  );
}

/** The same figures by electoral list, in one table. */
export function TablaCandidaturas({ filas, camara }: { filas: readonly FilaGrupo[]; camara: FilaGrupo }) {
  const conDato = scoring.metricas.filter((metrica) => valorDe(camara.agregado, metrica.id) !== null);
  const fila = (item: FilaGrupo) => {
    const { agregado } = item;
    const formaciones = (agregado.formaciones ?? []).filter((formacion) => formacion !== agregado.id);
    return (
      <tr>
        <th scope="row">
          <Nombre fila={item} />
          {formaciones.length > 0 ? <span class="secundario">Incluye {formaciones.join(', ')}</span> : null}
        </th>
        <td class="num" data-label="Diputados">
          {num(agregado.diputados)}
        </td>
        <td class="num" data-label="Mediana del índice">
          {agregado.indice ? num(agregado.indice.mediana, scoring.decimales) : <NoDisponible />}
        </td>
        {conDato.map((metrica) => {
          const valor = valorDe(agregado, metrica.id);
          return (
            <td class="num" data-label={metrica.nombreCorto}>
              {valor === null ? <NoDisponible /> : valorAgregado(valor, metrica.unidad)}
            </td>
          );
        })}
      </tr>
    );
  };
  return (
    <div class="tarjeta desborde">
      <table class="lista-tabla apilable candidaturas">
        <thead>
          <tr>
            <th scope="col">Candidatura</th>
            <th scope="col" class="num">
              Diputados
            </th>
            <th scope="col" class="num">
              Mediana del índice
            </th>
            {conDato.map((metrica) => (
              <th scope="col" class="num" title={metrica.nombre}>
                {metrica.nombreCorto}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map(fila)}
          {fila(camara)}
        </tbody>
      </table>
    </div>
  );
}
