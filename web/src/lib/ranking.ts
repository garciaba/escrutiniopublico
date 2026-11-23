/**
 * Logic of the ranking table, shared by the server render, the Preact island and the
 * tests: compact data for the page, URL state, filters and sorting. Pure functions.
 */
import type { Ranking } from './data.ts';
import { sinAcentos } from './format.ts';

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
    diputados.push([fila.slug, fila.nombre, fila.partido, fila.circunscripcion]);
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
  partido: string;
  circunscripcion: string;
  /** 'posicion', 'nombre', 'indice' or the id of a dimension. */
  orden: string;
  dir: 'asc' | 'desc';
  /** Include members of the Government, who are outside the general ranking. */
  gobierno: boolean;
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
    partido: elegir('partido', partidos),
    circunscripcion: elegir('circunscripcion', circunscripciones),
    orden,
    dir: dir === 'asc' || dir === 'desc' ? dir : direccionPorDefecto(orden),
    gobierno: params.get('gobierno') === '1',
  };
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
  if (estado.partido) params.set('partido', estado.partido);
  if (estado.circunscripcion) params.set('circunscripcion', estado.circunscripcion);
  if (estado.orden !== inicial.orden) params.set('orden', estado.orden);
  if (estado.dir !== direccionPorDefecto(estado.orden)) params.set('dir', estado.dir);
  if (estado.gobierno) params.set('gobierno', '1');
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

/** "A", "A y B", "A, B y C". */
export function enumerar(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1] ?? ''}`;
}
