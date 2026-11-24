/**
 * Ranking list of the home page (decision D-038). The same component renders the
 * static HTML at build time, with the first ten deputies, and runs in the browser,
 * where it adds the search, the province, the filters, the sorting, the pages, the
 * detail of each row and the selection to compare.
 *
 * The list is read ten by ten. Whoever has no JavaScript gets the first ten and a
 * link to the complete list, which is a plain page.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { fechaLarga, motivoPeriodo, num, rolEtiqueta } from '../lib/format.ts';
import {
  aplicar,
  direccionPorDefecto,
  enumerar,
  escribirComparar,
  escribirEstado,
  estadoInicial,
  filasDe,
  filtrosActivos,
  leerEstado,
  MAX_COMPARAR,
  opciones,
  ordenes,
  paginar,
  rangoPaginas,
  type Estado,
  type Fila,
  type RankingData,
} from '../lib/ranking.ts';
import { PuntoGrupo, Puntuacion } from './parts.tsx';

const SITUACION_ETIQUETA: Readonly<Record<string, string>> = {
  gobierno: 'Gobierno · fuera del ranking',
  periodo_insuficiente: 'Periodo insuficiente',
};

/** Filters kept inside the panel; the search and the province are always in sight. */
const EN_PANEL: ReadonlySet<string> = new Set(['grupo', 'partido', 'periodo', 'gobierno', 'orden']);

function columnas(data: RankingData): { id: string; nombre: string; clase: string; titulo?: string }[] {
  return [
    { id: 'posicion', nombre: 'N.º', clase: 'c-pos', titulo: 'Posición en el ranking general' },
    { id: 'nombre', nombre: 'Diputado', clase: 'c-nom' },
    { id: 'indice', nombre: 'Índice', clase: 'c-num c-ind' },
    ...data.dimensiones.map((d) => ({ id: d.id, nombre: d.corto, clase: 'c-num c-dim', titulo: d.nombre })),
  ];
}

interface HeadProps {
  data: RankingData;
  estado: Estado;
  /** False in the static HTML: the header buttons do nothing until the browser takes over. */
  activo: boolean;
  onOrden: (orden: string) => void;
}

function RankingHead({ data, estado, activo, onOrden }: HeadProps) {
  return (
    <tr>
      {columnas(data).flatMap((columna) => {
        const ordenada = estado.orden === columna.id;
        const celda = (
          <th
            scope="col"
            key={columna.id}
            class={columna.clase}
            title={columna.titulo}
            aria-sort={ordenada ? (estado.dir === 'asc' ? 'ascending' : 'descending') : undefined}
          >
            <button type="button" class="orden" disabled={!activo} onClick={() => onOrden(columna.id)}>
              {columna.nombre}
              <svg viewBox="0 0 8 10" aria-hidden="true" focusable="false">
                <path class="sube" d="M4 0l4 4H0z" />
                <path class="baja" d="M4 10L0 6h8z" />
              </svg>
            </button>
          </th>
        );
        return columna.id === 'indice'
          ? [
              celda,
              <th scope="col" class="c-mas" key="mas">
                <span class="sr">Detalle</span>
              </th>,
            ]
          : [celda];
      })}
      <th scope="col" class="c-acc">
        <span class="sr">Acciones</span>
      </th>
    </tr>
  );
}

interface RowProps {
  data: RankingData;
  fila: Fila;
  activo: boolean;
  abierta: boolean;
  elegido: boolean;
  /** The selection to compare is full: no more deputies can be added. */
  lleno: boolean;
  onAbrir: (slug: string) => void;
  onComparar: (slug: string) => void;
}

function RankingRow({ data, fila, activo, abierta, elegido, lleno, onAbrir, onComparar }: RowProps) {
  const grupo = data.grupos.find((g) => g.id === fila.grupo);
  const situacion = SITUACION_ETIQUETA[fila.situacion];
  const candidatura = fila.partido.toLowerCase() === (grupo?.nombre ?? '').toLowerCase() ? null : fila.partido;
  const clases = [fila.situacion === 'ranking' ? '' : 'fuera', abierta ? 'abierta' : ''].filter(Boolean).join(' ');
  return (
    <tr
      class={clases || undefined}
      onClick={(event) => {
        // A tap anywhere on the card opens it, except on what already does something.
        if (event.target instanceof Element && !event.target.closest('a, button')) onAbrir(fila.slug);
      }}
    >
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
        <span class="meta">
          <PuntoGrupo color={grupo?.color ?? '#9c9c9c'} />
          {grupo?.nombre ?? fila.grupo}
          {candidatura ? ` · ${candidatura}` : ''} · {fila.circunscripcion}
        </span>
      </th>
      <td class="c-num c-ind">
        <Puntuacion valor={fila.indice} />
      </td>
      <td class="c-mas">
        <button
          type="button"
          class="mas"
          aria-expanded={abierta}
          aria-label={`Dimensiones de ${fila.nombre}`}
          disabled={!activo}
          onClick={() => onAbrir(fila.slug)}
        >
          <svg viewBox="0 0 12 8" aria-hidden="true" focusable="false">
            <path d="M1 1.5l5 5 5-5" />
          </svg>
        </button>
      </td>
      {data.dimensiones.map((dimension, i) => (
        <td class="c-num c-dim" data-label={dimension.nombre} key={dimension.id}>
          <Puntuacion valor={fila.dims[i]} />
        </td>
      ))}
      <td class="c-acc">
        <a class="ver-ficha" href={`/diputados/${fila.slug}`}>
          Ver ficha<span class="sr"> de {fila.nombre}</span>
        </a>
        <button
          type="button"
          class="comparar"
          aria-pressed={elegido}
          disabled={!activo || (!elegido && lleno)}
          title={!elegido && lleno ? `Se comparan ${MAX_COMPARAR} como máximo` : undefined}
          onClick={() => onComparar(fila.slug)}
        >
          {elegido ? <span aria-hidden="true">✓ </span> : null}
          Comparar<span class="sr"> a {fila.nombre}</span>
        </button>
      </td>
    </tr>
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
}

export function RankingApp({ data, ejecutado, horasAviso, legislaturaFinalizada }: AppProps) {
  const inicial = useMemo(() => estadoInicial(data), [data]);
  const listas = useMemo(() => opciones(data), [data]);
  const [activo, setActivo] = useState(false);
  const [estado, setEstado] = useState<Estado>(inicial);
  const [antiguo, setAntiguo] = useState(false);
  const [panel, setPanel] = useState(false);
  const [abiertas, setAbiertas] = useState<readonly string[]>([]);
  const [comparar, setComparar] = useState<readonly string[]>([]);
  const lista = useRef<HTMLDivElement>(null);
  /** Set by the pager: the next render brings the top of the list back into view. */
  const subir = useRef(false);

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
  const pagina = useMemo(() => paginar(visibles, estado.pagina), [visibles, estado.pagina]);
  const total = useMemo(
    () => filas.filter((fila) => estado.gobierno || fila.situacion !== 'gobierno').length,
    [filas, estado.gobierno],
  );
  const activos = useMemo(() => filtrosActivos(estado, data), [estado, data]);
  const consulta = escribirEstado({ ...estado, pagina: pagina.pagina }, data);

  /** Any change of search, filter or order starts again from the first page. */
  const cambiar = (cambios: Partial<Estado>) => setEstado((previo) => ({ ...previo, ...cambios, pagina: 1 }));
  const ordenar = (orden: string) =>
    setEstado((previo) => ({
      ...previo,
      orden,
      dir: previo.orden === orden ? (previo.dir === 'asc' ? 'desc' : 'asc') : direccionPorDefecto(orden),
      pagina: 1,
    }));
  const irA = (numero: number) => {
    subir.current = true;
    setEstado((previo) => ({ ...previo, pagina: numero }));
  };
  const alternar = (lista: readonly string[], slug: string) =>
    lista.includes(slug) ? lista.filter((otro) => otro !== slug) : [...lista, slug];

  useEffect(() => {
    if (!activo) return;
    if (consulta !== window.location.search) {
      window.history.replaceState(null, '', `${window.location.pathname}${consulta}${window.location.hash}`);
    }
  }, [activo, consulta]);

  useEffect(() => {
    if (!subir.current) return;
    subir.current = false;
    if ((lista.current?.getBoundingClientRect().top ?? 0) < 0) lista.current?.scrollIntoView({ block: 'start' });
  }, [pagina.pagina]);

  const periodo = data.periodos.find((p) => p.id === estado.periodo);
  const noDisponibles = data.periodos.filter((p) => !p.disponible);
  const enPanel = activos.filter((filtro) => EN_PANEL.has(filtro.id)).length;
  const nombres = new Map(data.diputados.map((d) => [d[0], d[1]]));

  return (
    <div class="ranking-app">
      <div class="aviso" role="status" hidden={!antiguo}>
        <span>
          <strong>Datos sin actualizar.</strong> La última actualización es del {fechaLarga(ejecutado)}, hace más de{' '}
          {horasAviso} horas.
        </span>
      </div>

      <div class="barra" role="search" aria-label="Buscar y filtrar el ranking">
        <div class="barra-buscar">
          <label class="sr" for="ranking-q">
            Buscar diputado
          </label>
          <input
            id="ranking-q"
            type="search"
            placeholder="Buscar diputado"
            autocomplete="off"
            spellcheck={false}
            maxLength={80}
            disabled={!activo}
            value={estado.q}
            onInput={(event) => cambiar({ q: event.currentTarget.value })}
          />
        </div>
        <div class="barra-provincia">
          <label class="sr" for="ranking-circunscripcion">
            ¿Quién te representa? Elige tu provincia
          </label>
          <select
            id="ranking-circunscripcion"
            disabled={!activo}
            value={estado.circunscripcion}
            onChange={(event) => cambiar({ circunscripcion: event.currentTarget.value })}
          >
            <option value="">{estado.circunscripcion ? 'Todas las provincias' : 'Tu provincia'}</option>
            {listas.circunscripciones.map((circunscripcion) => (
              <option value={circunscripcion} key={circunscripcion}>
                {circunscripcion}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          class="boton barra-filtros"
          aria-expanded={panel}
          aria-controls="ranking-filtros"
          disabled={!activo}
          onClick={() => setPanel((abierto) => !abierto)}
        >
          <svg viewBox="0 0 16 12" aria-hidden="true" focusable="false">
            <path d="M1 2h14M3.5 6h9M6 10h4" />
          </svg>
          Filtros
          {enPanel > 0 ? (
            <span class="cuenta">
              {enPanel}
              <span class="sr"> activos</span>
            </span>
          ) : null}
        </button>
      </div>

      <div id="ranking-filtros" class="filtros tarjeta" hidden={!panel}>
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
          {noDisponibles.length > 0 ? (
            <p class="segmento-nota">
              Sin datos para {enumerar(noDisponibles.map((p) => p.nombre.toLowerCase()))}
              {legislaturaFinalizada ? ': la legislatura ha terminado.' : '.'}
            </p>
          ) : null}
        </fieldset>
        <div class="filtros-fila">
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
            <label for="ranking-partido">Candidatura</label>
            <select
              id="ranking-partido"
              disabled={!activo}
              value={estado.partido}
              onChange={(event) => cambiar({ partido: event.currentTarget.value })}
            >
              <option value="">Todas</option>
              {listas.partidos.map((partido) => (
                <option value={partido} key={partido}>
                  {partido}
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
              {ordenes(data).map((opcion) => (
                <option value={`${opcion.orden}:${opcion.dir}`} key={`${opcion.orden}:${opcion.dir}`}>
                  {opcion.etiqueta}
                </option>
              ))}
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
          Incluir a los miembros del Gobierno (fuera del ranking)
        </label>
      </div>

      <div class="estado">
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
          {periodo && periodo.id !== inicial.periodo ? (
            <span class="muted"> · {periodo.nombre.toLowerCase()}</span>
          ) : null}
        </p>
        {activos.length > 0 ? (
          <ul class="chips" aria-label="Filtros activos">
            {activos.map((filtro) => (
              <li key={filtro.id}>
                <button type="button" class="chip" onClick={() => cambiar(filtro.quitar)}>
                  {filtro.etiqueta}
                  <span aria-hidden="true">✕</span>
                  <span class="sr"> (quitar)</span>
                </button>
              </li>
            ))}
            {activos.length > 1 ? (
              <li>
                <button type="button" class="chip todo" onClick={() => setEstado(inicial)}>
                  Quitar todo
                </button>
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      <div class="lista tarjeta" ref={lista}>
        <table class="tabla" id="ranking-tabla">
          <caption class="sr">
            Ranking de actividad parlamentaria: posición, diputado, índice global y puntuación por dimensión
          </caption>
          <thead>
            <RankingHead data={data} estado={estado} activo={activo} onOrden={ordenar} />
          </thead>
          <tbody>
            {pagina.filas.length === 0 ? (
              <tr>
                <td class="vacio" colSpan={5 + data.dimensiones.length}>
                  Ningún diputado coincide.
                </td>
              </tr>
            ) : (
              pagina.filas.map((fila) => (
                <RankingRow
                  key={fila.slug}
                  data={data}
                  fila={fila}
                  activo={activo}
                  abierta={abiertas.includes(fila.slug)}
                  elegido={comparar.includes(fila.slug)}
                  lleno={comparar.length >= MAX_COMPARAR}
                  onAbrir={(slug) => setAbiertas((previas) => alternar(previas, slug))}
                  onComparar={(slug) => setComparar((previos) => alternar(previos, slug))}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagina.paginas > 1 ? (
        <nav class="paginas" aria-label="Páginas del ranking">
          <button
            type="button"
            class="boton"
            disabled={!activo || pagina.pagina <= 1}
            onClick={() => irA(pagina.pagina - 1)}
          >
            <span aria-hidden="true">←</span> Anterior
          </button>
          <ol>
            {rangoPaginas(pagina.pagina, pagina.paginas).map((numero, i) =>
              numero === null ? (
                <li class="hueco" aria-hidden="true" key={`hueco-${i}`}>
                  …
                </li>
              ) : (
                <li key={numero}>
                  <button
                    type="button"
                    class="numero"
                    aria-label={`Página ${numero}`}
                    aria-current={numero === pagina.pagina ? 'page' : undefined}
                    disabled={!activo}
                    onClick={() => irA(numero)}
                  >
                    {numero}
                  </button>
                </li>
              ),
            )}
          </ol>
          <p class="paginas-estado">
            {num(pagina.desde)}–{num(pagina.hasta)} de {num(visibles.length)}
          </p>
          <button
            type="button"
            class="boton"
            disabled={!activo || pagina.pagina >= pagina.paginas}
            onClick={() => irA(pagina.pagina + 1)}
          >
            Siguiente <span aria-hidden="true">→</span>
          </button>
        </nav>
      ) : null}

      {comparar.length > 0 ? (
        <div class="bandeja tarjeta" role="region" aria-label="Diputados para comparar">
          <ul class="chips">
            {comparar.map((slug) => (
              <li key={slug}>
                <button type="button" class="chip" onClick={() => setComparar((previos) => alternar(previos, slug))}>
                  {nombres.get(slug) ?? slug}
                  <span aria-hidden="true">✕</span>
                  <span class="sr"> (quitar)</span>
                </button>
              </li>
            ))}
          </ul>
          {comparar.length >= 2 ? (
            <a class="boton principal" href={`/comparar${escribirComparar(comparar)}`}>
              Comparar
            </a>
          ) : (
            <span class="muted">Elige otro</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
