/**
 * Logic of the ranking list, shared by the server render, the Preact island and the
 * tests: compact data for the page, URL state, filters, sorting, pages and the
 * selection to compare. Pure functions.
 */
import type { Ranking } from './data.ts';
import { nombreCircunscripcion, sinAcentos } from './format.ts';

/** Deputies shown at a time: the list is read ten by ten (decision D-038). */
export const POR_PAGINA = 10;
/** Deputies that can be compared side by side. */
export const MAX_COMPARAR = 3;

export type Situacion = 'ranking' | 'gobierno' | 'periodo_insuficiente';
const SITUACIONES: readonly Situacion[] = ['ranking', 'gobierno', 'periodo_insuficiente'];

/** [slug, nombre, partido, circunscripción] */
export type DiputadoBase = readonly [string, string, string, string];
/** [índice en `diputados`, grupo, roles separados por coma, situación, índice, posición, …dimensiones] */
export type FilaCompacta = readonly [
  number,
  string,
  string,
  number,
  number | null,
  number | null,
  ...(number | null)[],
];

export interface PeriodoData {
  id: string;
  nombre: string;
  disponible: boolean;
  motivo: string | null;
  desde: string | null;
  hasta: string | null;
  total: number;
  filas: FilaCompacta[];
}

/** Everything the table needs, in a compact shape that is serialized into the page. */
export interface RankingData {
  diputados: DiputadoBase[];
  grupos: { id: string; nombre: string; color: string }[];
  /** Only the dimensions with data; `corto` heads the column. */
  dimensiones: { id: string; nombre: string; corto: string }[];
  periodos: PeriodoData[];
}

export interface Presentacion {
  /** Colour of the dot of each group, by group id. */
  colores: Readonly<Record<string, string>>;
  /** Short name of each dimension, by dimension id. */
  nombresCortos: Readonly<Record<string, string>>;
}

export function compactar(ranking: Ranking, { colores, nombresCortos }: Presentacion): RankingData {
  const conDato = new Set<string>();
  for (const fila of ranking.filas) {
    for (const [id, value] of Object.entries(fila.dimensiones)) if (value !== null) conDato.add(id);
  }
  const dimensiones = ranking.dimensiones
    .filter((d) => conDato.has(d.id))
    .map(({ id, nombre }) => ({ id, nombre, corto: nombresCortos[id] ?? nombre }));
  const posicion = new Map<string, number>();
  const diputados: DiputadoBase[] = [];
  for (const fila of ranking.filas) {
    if (posicion.has(fila.slug)) continue;
    posicion.set(fila.slug, diputados.length);
    diputados.push([fila.slug, fila.nombre, fila.partido, nombreCircunscripcion(fila.circunscripcion)]);
  }
  return {
    diputados,
    grupos: ranking.grupos.map((g) => ({ id: g.id, nombre: g.nombre_corto, color: colores[g.id] ?? '#9c9c9c' })),
    dimensiones,
    periodos: ranking.periodos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      disponible: p.estado === 'disponible',
      motivo: p.motivo,
      desde: p.desde,
      hasta: p.hasta,
      total: p.total_ranking,
      filas: ranking.filas
        .filter((fila) => fila.periodo === p.id)
        .map((fila): FilaCompacta => [
          posicion.get(fila.slug) ?? 0,
          fila.grupo,
          fila.roles.join(','),
          SITUACIONES.indexOf(fila.situacion),
          fila.indice,
          fila.posicion,
          ...dimensiones.map((d) => fila.dimensiones[d.id] ?? null),
        ]),
    })),
  };
}

export interface Fila {
  slug: string;
  nombre: string;
  partido: string;
  circunscripcion: string;
  grupo: string;
  roles: string[];
  situacion: Situacion;
  indice: number | null;
  posicion: number | null;
  dims: (number | null)[];
}

export function filasDe(data: RankingData, periodoId: string): Fila[] {
  const periodo = data.periodos.find((p) => p.id === periodoId);
  if (!periodo) return [];
  return periodo.filas.map(([i, grupo, roles, situacion, indice, posicion, ...dims]) => {
    const [slug, nombre, partido, circunscripcion] = data.diputados[i] ?? ['', '', '', ''];
    return {
      slug,
      nombre,
      partido,
      circunscripcion,
      grupo,
      roles: roles ? roles.split(',') : [],
      situacion: SITUACIONES[situacion] ?? 'ranking',
      indice,
      posicion,
      dims,
    };
  });
}

export interface Estado {
  periodo: string;
  q: string;
  grupo: string;
  /** Electoral list the deputy was elected on (census formation, federations grouped). */
  partido: string;
  circunscripcion: string;
  /** 'posicion', 'nombre', 'indice' or the id of a dimension. */
  orden: string;
  dir: 'asc' | 'desc';
  /** Include members of the Government, who are outside the general ranking. */
  gobierno: boolean;
  /** Page of the list, from 1. Any other change of state goes back to the first. */
  pagina: number;
}

export function estadoInicial(data: RankingData): Estado {
  return {
    periodo: data.periodos.find((p) => p.disponible)?.id ?? data.periodos[0]?.id ?? '',
    q: '',
    grupo: '',
    partido: '',
    circunscripcion: '',
    orden: 'posicion',
    dir: 'asc',
    gobierno: false,
    pagina: 1,
  };
}

export interface Opciones {
  grupos: { id: string; nombre: string }[];
  partidos: string[];
  circunscripciones: string[];
}

/** Values of the drop-downs, in alphabetical order. */
export function opciones(data: RankingData): Opciones {
  const alfabetico = (a: string, b: string) => a.localeCompare(b, 'es');
  return {
    grupos: data.grupos.map(({ id, nombre }) => ({ id, nombre })).sort((a, b) => alfabetico(a.nombre, b.nombre)),
    partidos: [...new Set(data.diputados.map((d) => d[2]))].sort(alfabetico),
    circunscripciones: [...new Set(data.diputados.map((d) => d[3]))].sort(alfabetico),
  };
}

/** Reads the state from the query string, ignoring unknown values. */
export function leerEstado(search: string, data: RankingData): Estado {
  const params = new URLSearchParams(search);
  const inicial = estadoInicial(data);
  const { grupos, partidos, circunscripciones } = opciones(data);
  const elegir = (key: string, validos: readonly string[]) => {
    const value = params.get(key) ?? '';
    return validos.includes(value) ? value : '';
  };
  const periodo = params.get('periodo') ?? '';
  const ordenes = ['posicion', 'nombre', 'indice', ...data.dimensiones.map((d) => d.id)];
  const orden = elegir('orden', ordenes) || inicial.orden;
  const dir = params.get('dir');
  return {
    periodo: data.periodos.some((p) => p.id === periodo && p.disponible) ? periodo : inicial.periodo,
    q: (params.get('q') ?? '').slice(0, 80),
    grupo: elegir(
      'grupo',
      grupos.map((g) => g.id),
    ),
    // The electoral list; `partido` is the name the parameter had before (D-037).
    partido: elegir(params.has('candidatura') ? 'candidatura' : 'partido', partidos),
    // Links shared before the names were made readable carry "Palmas (Las)".
    circunscripcion: circunscripciones.includes(nombreCircunscripcion(params.get('circunscripcion') ?? ''))
      ? nombreCircunscripcion(params.get('circunscripcion') ?? '')
      : '',
    orden,
    dir: dir === 'asc' || dir === 'desc' ? dir : direccionPorDefecto(orden),
    gobierno: params.get('gobierno') === '1',
    pagina: enteroPositivo(params.get('pagina')) ?? 1,
  };
}

function enteroPositivo(text: string | null): number | undefined {
  if (!text || !/^[0-9]{1,4}$/.test(text)) return undefined;
  const value = Number(text);
  return value >= 1 ? value : undefined;
}

export function direccionPorDefecto(orden: string): 'asc' | 'desc' {
  return orden === 'posicion' || orden === 'nombre' ? 'asc' : 'desc';
}

/** Query string for a state; values equal to the default are left out so URLs stay short. */
export function escribirEstado(estado: Estado, data: RankingData): string {
  const inicial = estadoInicial(data);
  const params = new URLSearchParams();
  if (estado.periodo !== inicial.periodo) params.set('periodo', estado.periodo);
  if (estado.q.trim()) params.set('q', estado.q.trim());
  if (estado.grupo) params.set('grupo', estado.grupo);
  if (estado.partido) params.set('candidatura', estado.partido);
  if (estado.circunscripcion) params.set('circunscripcion', estado.circunscripcion);
  if (estado.orden !== inicial.orden) params.set('orden', estado.orden);
  if (estado.dir !== direccionPorDefecto(estado.orden)) params.set('dir', estado.dir);
  if (estado.gobierno) params.set('gobierno', '1');
  if (estado.pagina > 1) params.set('pagina', String(estado.pagina));
  const text = params.toString();
  return text ? `?${text}` : '';
}

/** Filters and sorts. Rows without a value for the sort column always go last. */
export function aplicar(filas: readonly Fila[], estado: Estado, data: RankingData): Fila[] {
  // Every word typed must appear in the name, in any order ("cristina abades").
  const palabras = sinAcentos(estado.q)
    .split(/[\s,]+/)
    .filter(Boolean);
  const visibles = filas.filter((fila) => {
    if (!estado.gobierno && fila.situacion === 'gobierno') return false;
    if (estado.grupo && fila.grupo !== estado.grupo) return false;
    if (estado.partido && fila.partido !== estado.partido) return false;
    if (estado.circunscripcion && fila.circunscripcion !== estado.circunscripcion) return false;
    if (palabras.length === 0) return true;
    const nombre = sinAcentos(fila.nombre);
    return palabras.every((palabra) => nombre.includes(palabra));
  });
  const porNombre = (a: Fila, b: Fila) => a.nombre.localeCompare(b.nombre, 'es');
  const sentido = estado.dir === 'asc' ? 1 : -1;
  if (estado.orden === 'nombre') return visibles.sort((a, b) => sentido * porNombre(a, b));
  const dim = data.dimensiones.findIndex((d) => d.id === estado.orden);
  const valor = (fila: Fila): number | null =>
    estado.orden === 'posicion' ? fila.posicion : estado.orden === 'indice' ? fila.indice : (fila.dims[dim] ?? null);
  return visibles.sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    if (va === null || vb === null) return va === vb ? porNombre(a, b) : va === null ? 1 : -1;
    return sentido * (va - vb) || porNombre(a, b);
  });
}

export interface Pagina<T> {
  /** Page actually shown: the one asked for, brought inside the range. */
  pagina: number;
  paginas: number;
  /** Position in the whole list of the first and the last row shown, from 1; 0 when empty. */
  desde: number;
  hasta: number;
  filas: T[];
}

export function paginar<T>(filas: readonly T[], pagina: number, porPagina: number = POR_PAGINA): Pagina<T> {
  const paginas = Math.max(1, Math.ceil(filas.length / porPagina));
  const actual = Math.min(Math.max(1, Math.trunc(pagina) || 1), paginas);
  const inicio = (actual - 1) * porPagina;
  const visibles = filas.slice(inicio, inicio + porPagina);
  return {
    pagina: actual,
    paginas,
    desde: visibles.length === 0 ? 0 : inicio + 1,
    hasta: inicio + visibles.length,
    filas: visibles,
  };
}

/**
 * Page numbers the pager offers: the first, the last and those around the current
 * one; `null` marks a gap. With seven pages or fewer, all of them.
 */
export function rangoPaginas(pagina: number, paginas: number): (number | null)[] {
  if (paginas <= 7) return Array.from({ length: paginas }, (_, i) => i + 1);
  let desde = Math.max(2, Math.min(pagina - 1, paginas - 4));
  let hasta = Math.min(paginas - 1, Math.max(pagina + 1, 5));
  // A gap that would hide a single page shows that page instead.
  if (desde === 3) desde = 2;
  if (hasta === paginas - 2) hasta = paginas - 1;
  const centro = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
  return [1, ...(desde > 2 ? [null] : []), ...centro, ...(hasta < paginas - 1 ? [null] : []), paginas];
}

export interface FiltroActivo {
  id: string;
  etiqueta: string;
  /** Change of state that removes it. */
  quitar: Partial<Estado>;
}

/** What narrows or reorders the list right now, to show as removable labels. */
export function filtrosActivos(estado: Estado, data: RankingData): FiltroActivo[] {
  const inicial = estadoInicial(data);
  const activos: FiltroActivo[] = [];
  if (estado.q.trim()) activos.push({ id: 'q', etiqueta: `«${estado.q.trim()}»`, quitar: { q: '' } });
  if (estado.circunscripcion) {
    activos.push({ id: 'circunscripcion', etiqueta: estado.circunscripcion, quitar: { circunscripcion: '' } });
  }
  if (estado.grupo) {
    const grupo = data.grupos.find((g) => g.id === estado.grupo);
    activos.push({ id: 'grupo', etiqueta: `Grupo: ${grupo?.nombre ?? estado.grupo}`, quitar: { grupo: '' } });
  }
  if (estado.partido) {
    activos.push({ id: 'partido', etiqueta: `Candidatura: ${estado.partido}`, quitar: { partido: '' } });
  }
  if (estado.periodo !== inicial.periodo) {
    const periodo = data.periodos.find((p) => p.id === estado.periodo);
    activos.push({ id: 'periodo', etiqueta: periodo?.nombre ?? estado.periodo, quitar: { periodo: inicial.periodo } });
  }
  if (estado.gobierno) activos.push({ id: 'gobierno', etiqueta: 'Con el Gobierno', quitar: { gobierno: false } });
  if (estado.orden !== inicial.orden || estado.dir !== direccionPorDefecto(estado.orden)) {
    activos.push({
      id: 'orden',
      etiqueta: `Orden: ${etiquetaOrden(estado.orden, estado.dir, data)}`,
      quitar: { orden: inicial.orden, dir: inicial.dir },
    });
  }
  return activos;
}

/** Sort options of the list, each in its natural direction first. */
export function ordenes(data: RankingData): { orden: string; dir: 'asc' | 'desc'; etiqueta: string }[] {
  const ids = ['posicion', 'nombre', 'indice', ...data.dimensiones.map((d) => d.id)];
  return ids.flatMap((orden) => {
    const natural = direccionPorDefecto(orden);
    return [natural, natural === 'asc' ? 'desc' : 'asc'].map((dir) => ({
      orden,
      dir: dir as 'asc' | 'desc',
      etiqueta: etiquetaOrden(orden, dir as 'asc' | 'desc', data),
    }));
  });
}

export function etiquetaOrden(orden: string, dir: 'asc' | 'desc', data: RankingData): string {
  if (orden === 'posicion') return dir === 'asc' ? 'Posición' : 'Posición, del último al primero';
  if (orden === 'nombre') return dir === 'asc' ? 'Nombre, A → Z' : 'Nombre, Z → A';
  const nombre = orden === 'indice' ? 'Índice' : (data.dimensiones.find((d) => d.id === orden)?.nombre ?? orden);
  return `${nombre}, ${dir === 'desc' ? 'de mayor a menor' : 'de menor a mayor'}`;
}

/** Deputies chosen to compare, from the `d` parameter: known, distinct, three at most. */
export function leerComparar(search: string, data: RankingData): string[] {
  const conocidos = new Set(data.diputados.map((d) => d[0]));
  const pedidos = (new URLSearchParams(search).get('d') ?? '').split(',').filter((slug) => conocidos.has(slug));
  return [...new Set(pedidos)].slice(0, MAX_COMPARAR);
}

export function escribirComparar(slugs: readonly string[]): string {
  return slugs.length === 0 ? '' : `?d=${slugs.map(encodeURIComponent).join(',')}`;
}

/** Deputies whose name contains every word typed, in alphabetical order. */
export function buscarDiputados(data: RankingData, q: string, limite: number): DiputadoBase[] {
  const palabras = sinAcentos(q)
    .split(/[\s,]+/)
    .filter(Boolean);
  if (palabras.length === 0) return [];
  return data.diputados
    .filter((d) => {
      const nombre = sinAcentos(d[1]);
      return palabras.every((palabra) => nombre.includes(palabra));
    })
    .sort((a, b) => a[1].localeCompare(b[1], 'es'))
    .slice(0, limite);
}

/** "A", "A y B", "A, B y C". */
export function enumerar(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1] ?? ''}`;
}
