/**
 * Ranking table of the home page. The same components render the static HTML at
 * build time (complete table, ordered by position, usable without JavaScript) and
 * run in the browser, where `RankingApp` adds search, filters, sorting and periods.
 *
 * To keep the page light, the browser only takes over the controls and the header
 * row. The 400 rows of the body stay as delivered until the visitor changes something.
 */
import { render } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { fechaLarga, motivoPeriodo, num, rolEtiqueta } from '../lib/format.ts';
import {
  aplicar,
  direccionPorDefecto,
  enumerar,
  escribirEstado,
  estadoInicial,
  filasDe,
  leerEstado,
  opciones,
  type Estado,
  type Fila,
  type RankingData,
} from '../lib/ranking.ts';
import { PuntoGrupo, Puntuacion } from './parts.tsx';

const SITUACION_ETIQUETA: Readonly<Record<string, string>> = {
  gobierno: 'Gobierno · fuera del ranking',
  periodo_insuficiente: 'Periodo insuficiente',
};

function columnas(data: RankingData): { id: string; nombre: string; clase: string; titulo?: string }[] {
  return [
    { id: 'posicion', nombre: 'N.º', clase: 'c-pos', titulo: 'Posición en el ranking general' },
    { id: 'nombre', nombre: 'Diputado', clase: 'c-nom' },
    { id: '', nombre: 'Grupo', clase: 'c-gru' },
    { id: '', nombre: 'Circunscripción', clase: 'c-cir' },
    { id: 'indice', nombre: 'Índice', clase: 'c-num c-ind' },
    ...data.dimensiones.map((d) => ({ id: d.id, nombre: d.corto, clase: 'c-num c-dim', titulo: d.nombre })),
  ];
}

interface HeadProps {
  data: RankingData;
  estado: Estado;
  /** False in the static HTML: the header buttons do nothing until the browser takes over. */
  activo: boolean;
  onOrden?: (orden: string) => void;
}

export function RankingHead({ data, estado, activo, onOrden }: HeadProps) {
  return (
    <tr>
      {columnas(data).map((columna) => {
        const ordenada = columna.id !== '' && estado.orden === columna.id;
        return (
          <th
            scope="col"
            class={columna.clase}
            title={columna.titulo}
            aria-sort={ordenada ? (estado.dir === 'asc' ? 'ascending' : 'descending') : undefined}
          >
            {columna.id === '' ? (
              columna.nombre
            ) : (
              <button type="button" class="orden" disabled={!activo} onClick={() => onOrden?.(columna.id)}>
                {columna.nombre}
                <svg viewBox="0 0 8 10" aria-hidden="true" focusable="false">
                  <path class="sube" d="M4 0l4 4H0z" />
                  <path class="baja" d="M4 10L0 6h8z" />
                </svg>
              </button>
            )}
          </th>
        );
      })}
    </tr>
  );
}

interface RowsProps {
  data: RankingData;
  filas: readonly Fila[];
}

export function RankingRows({ data, filas }: RowsProps) {
  const grupos = new Map(data.grupos.map((grupo) => [grupo.id, grupo]));
  if (filas.length === 0) {
    return (
      <tr>
        <td class="vacio" colSpan={5 + data.dimensiones.length}>
          Ningún diputado coincide con la búsqueda y los filtros.
        </td>
      </tr>
    );
  }
  return (
    <>
      {filas.map((fila) => {
        const grupo = grupos.get(fila.grupo);
        const situacion = SITUACION_ETIQUETA[fila.situacion];
        return (
          <tr key={fila.slug} class={fila.situacion === 'ranking' ? undefined : 'fuera'}>
            <td class="c-pos">
              {fila.posicion === null ? (
                <span class="nd">
                  <span aria-hidden="true">—</span>
                  <span class="sr">Sin posición</span>
                </span>
              ) : (
                fila.posicion
              )}
            </td>
            <th scope="row" class="c-nom">
              <a href={`/diputados/${fila.slug}`}>{fila.nombre}</a>
              {fila.roles
                .filter((rol) => rol !== 'gobierno' || fila.situacion !== 'gobierno')
                .map((rol) => (
                  <span class="etiqueta" key={rol}>
                    {rol === 'gobierno' ? 'Exmiembro del Gobierno' : rolEtiqueta(rol)}
                  </span>
                ))}
              {situacion ? <span class="etiqueta rayada">{situacion}</span> : null}
            </th>
            <td class="c-gru">
              <PuntoGrupo color={grupo?.color ?? '#9c9c9c'} />
              {grupo?.nombre ?? fila.grupo}
              {fila.partido.toLowerCase() === (grupo?.nombre ?? '').toLowerCase() ? null : (
                <span class="partido">{fila.partido}</span>
              )}
              <span class="cir-movil"> · {fila.circunscripcion}</span>
            </td>
            <td class="c-cir">{fila.circunscripcion}</td>
            <td class="c-num c-ind">
              <Puntuacion valor={fila.indice} />
            </td>
            {data.dimensiones.map((dimension, i) => (
              <td class="c-num c-dim" data-label={dimension.corto} key={dimension.id}>
                <Puntuacion valor={fila.dims[i]} />
              </td>
            ))}
          </tr>
        );
      })}
    </>
  );
}

export interface AppProps {
  data: RankingData;
  /** ISO date and time of the last pipeline run; drives the stale-data warning. */
  ejecutado: string;
  /** Hours after which the data are flagged as old. */
  horasAviso: number;
  /** The legislature is over: the short periods have no data and the note says why. */
  legislaturaFinalizada: boolean;
  /** Elements of the static table the browser takes over (absent at build time). */
  thead?: Element | null;
  tbody?: Element | null;
}

export function RankingApp({ data, ejecutado, horasAviso, legislaturaFinalizada, thead, tbody }: AppProps) {
  const inicial = useMemo(() => estadoInicial(data), [data]);
  const listas = useMemo(() => opciones(data), [data]);
  const [activo, setActivo] = useState(false);
  const [estado, setEstado] = useState<Estado>(inicial);
  const [antiguo, setAntiguo] = useState(false);
  /** True once the browser has rendered that part of the table; from then on it is kept in sync. */
  const cabeceraPropia = useRef(false);
  const cuerpoPropio = useRef(false);

  useEffect(() => {
    setEstado(leerEstado(window.location.search, data));
    setAntiguo(Date.now() - Date.parse(ejecutado) > horasAviso * 3_600_000);
    setActivo(true);
    const alNavegar = () => setEstado(leerEstado(window.location.search, data));
    window.addEventListener('popstate', alNavegar);
    return () => window.removeEventListener('popstate', alNavegar);
  }, [data, ejecutado, horasAviso]);

  const filas = useMemo(() => filasDe(data, estado.periodo), [data, estado.periodo]);
  const visibles = useMemo(() => aplicar(filas, estado, data), [filas, estado, data]);
  const total = useMemo(
    () => filas.filter((fila) => estado.gobierno || fila.situacion !== 'gobierno').length,
    [filas, estado.gobierno],
  );
  const consulta = escribirEstado(estado, data);

  const cambiar = (cambios: Partial<Estado>) => setEstado((previo) => ({ ...previo, ...cambios }));
  const ordenar = (orden: string) =>
    setEstado((previo) => ({
      ...previo,
      orden,
      dir: previo.orden === orden ? (previo.dir === 'asc' ? 'desc' : 'asc') : direccionPorDefecto(orden),
    }));

  useEffect(() => {
    if (!activo) return;
    if (consulta !== window.location.search) {
      window.history.replaceState(null, '', `${window.location.pathname}${consulta}${window.location.hash}`);
    }
    // The static rows were not created by Preact, which would keep them next to its own:
    // each part is emptied the first time the browser renders it.
    if (thead) {
      if (!cabeceraPropia.current) thead.replaceChildren();
      cabeceraPropia.current = true;
      render(<RankingHead data={data} estado={estado} activo onOrden={ordenar} />, thead);
    }
    if (tbody && (cuerpoPropio.current || consulta !== '')) {
      if (!cuerpoPropio.current) tbody.replaceChildren();
      cuerpoPropio.current = true;
      render(<RankingRows data={data} filas={visibles} />, tbody);
    }
    // `ordenar` only uses the state setter, so it is safe to leave out.
  }, [activo, consulta, data, estado, visibles, thead, tbody]);

  const periodo = data.periodos.find((p) => p.id === estado.periodo);
  const noDisponibles = data.periodos.filter((p) => !p.disponible);
  const ordenes = [
    { id: 'posicion', nombre: 'Posición' },
    { id: 'nombre', nombre: 'Nombre' },
    { id: 'indice', nombre: 'Índice' },
    ...data.dimensiones.map((d) => ({ id: d.id, nombre: d.nombre })),
  ];

  return (
    <div class="controles tarjeta" role="search" aria-label="Buscar y filtrar el ranking">
      <div class="aviso" role="status" hidden={!antiguo}>
        <span>
          <strong>Datos sin actualizar.</strong> La última actualización es del {fechaLarga(ejecutado)}, hace más de{' '}
          {horasAviso} horas. Puede que falte actividad reciente.
        </span>
      </div>

      <div class="controles-cabeza">
        <div class="campo">
          <label for="ranking-q">Buscar diputado</label>
          <input
            id="ranking-q"
            type="search"
            placeholder="Nombre o apellidos"
            autocomplete="off"
            spellcheck={false}
            maxLength={80}
            disabled={!activo}
            value={estado.q}
            onInput={(event) => cambiar({ q: event.currentTarget.value })}
          />
        </div>

        <fieldset class="segmento" disabled={!activo}>
          <legend>Periodo</legend>
          <div class="segmento-opciones">
            {data.periodos.map((p) => (
              <label key={p.id}>
                <input
                  type="radio"
                  name="ranking-periodo"
                  value={p.id}
                  checked={estado.periodo === p.id}
                  disabled={!p.disponible}
                  title={p.disponible ? undefined : motivoPeriodo(p.motivo)}
                  onChange={() => cambiar({ periodo: p.id })}
                />
                {p.nombre}
              </label>
            ))}
          </div>
          <p class="segmento-nota">
            {periodo?.desde && periodo.hasta ? (
              <>
                Del {fechaLarga(periodo.desde)} al {fechaLarga(periodo.hasta)}.{' '}
              </>
            ) : null}
            {noDisponibles.length > 0 ? (
              <>
                Sin datos para {enumerar(noDisponibles.map((p) => p.nombre.toLowerCase()))}
                {legislaturaFinalizada ? ': la legislatura ya ha terminado.' : '.'}
              </>
            ) : null}
          </p>
        </fieldset>
      </div>

      <div class="controles-fila">
        <div class="campo">
          <label for="ranking-grupo">Grupo parlamentario</label>
          <select
            id="ranking-grupo"
            disabled={!activo}
            value={estado.grupo}
            onChange={(event) => cambiar({ grupo: event.currentTarget.value })}
          >
            <option value="">Todos</option>
            {listas.grupos.map((grupo) => (
              <option value={grupo.id} key={grupo.id}>
                {grupo.nombre}
              </option>
            ))}
          </select>
        </div>
        <div class="campo">
          <label for="ranking-partido">Partido</label>
          <select
            id="ranking-partido"
            disabled={!activo}
            value={estado.partido}
            onChange={(event) => cambiar({ partido: event.currentTarget.value })}
          >
            <option value="">Todos</option>
            {listas.partidos.map((partido) => (
              <option value={partido} key={partido}>
                {partido}
              </option>
            ))}
          </select>
        </div>
        <div class="campo">
          <label for="ranking-circunscripcion">Circunscripción</label>
          <select
            id="ranking-circunscripcion"
            disabled={!activo}
            value={estado.circunscripcion}
            onChange={(event) => cambiar({ circunscripcion: event.currentTarget.value })}
          >
            <option value="">Todas</option>
            {listas.circunscripciones.map((circunscripcion) => (
              <option value={circunscripcion} key={circunscripcion}>
                {circunscripcion}
              </option>
            ))}
          </select>
        </div>
        <div class="campo">
          <label for="ranking-orden">Ordenar por</label>
          <select
            id="ranking-orden"
            disabled={!activo}
            value={`${estado.orden}:${estado.dir}`}
            onChange={(event) => {
              const [orden = 'posicion', dir] = event.currentTarget.value.split(':');
              cambiar({ orden, dir: dir === 'desc' ? 'desc' : 'asc' });
            }}
          >
            {ordenes.flatMap((orden) => {
              const natural = direccionPorDefecto(orden.id);
              const inversa = natural === 'asc' ? 'desc' : 'asc';
              const sufijo = (dir: string) =>
                orden.id === 'nombre'
                  ? dir === 'asc'
                    ? 'A → Z'
                    : 'Z → A'
                  : dir === 'desc'
                    ? 'de mayor a menor'
                    : 'de menor a mayor';
              const etiqueta = (dir: string) =>
                orden.id === 'posicion'
                  ? dir === 'asc'
                    ? 'Posición'
                    : 'Posición, del último al primero'
                  : `${orden.nombre}, ${sufijo(dir)}`;
              return [natural, inversa].map((dir) => (
                <option value={`${orden.id}:${dir}`} key={`${orden.id}:${dir}`}>
                  {etiqueta(dir)}
                </option>
              ));
            })}
          </select>
        </div>
      </div>

      <label class="casilla">
        <input
          type="checkbox"
          disabled={!activo}
          checked={estado.gobierno}
          onChange={(event) => cambiar({ gobierno: event.currentTarget.checked })}
        />
        Incluir a los miembros del Gobierno, que quedan fuera del ranking general
      </label>

      <div class="controles-pie">
        <p class="recuento" role="status">
          {visibles.length === total ? (
            <>
              <strong>{num(total)}</strong> diputados
            </>
          ) : (
            <>
              <strong>{num(visibles.length)}</strong> de {num(total)} diputados
            </>
          )}
          <span class="muted"> · la posición es siempre la del ranking general</span>
        </p>
        {consulta !== '' ? (
          <button type="button" class="boton" onClick={() => setEstado(inicial)}>
            Quitar filtros
          </button>
        ) : null}
      </div>
    </div>
  );
}
