/**
 * Build-time access to data/derived/ (written by `pnpm pipeline`). Paths are relative
 * to the repository root, from where the pnpm scripts run Astro.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DERIVED = join(process.cwd(), 'data', 'derived');

function read<T>(...segments: string[]): T {
  return JSON.parse(readFileSync(join(DERIVED, ...segments), 'utf-8')) as T;
}

export interface Legislatura {
  numero: number;
  nombre: string;
  inicio: string;
  fin: string | null;
  finalizada: boolean;
}

export interface PeriodoResumen {
  id: string;
  nombre: string;
  estado: 'disponible' | 'no_disponible';
  motivo: string | null;
  desde: string | null;
  hasta: string | null;
  dias_minimos: number;
  poblacion_referencia: number;
  total_ranking: number;
  cobertura: number;
  metricas_disponibles: string[];
}

export interface FilaRanking {
  periodo: string;
  slug: string;
  nombre: string;
  grupo: string;
  partido: string;
  circunscripcion: string;
  roles: string[];
  situacion: 'ranking' | 'gobierno' | 'periodo_insuficiente';
  indice: number | null;
  cobertura: number | null;
  posicion: number | null;
  dimensiones: Record<string, number | null>;
}

export interface Ranking {
  metodologia_version: string;
  fecha_calculo: string;
  legislatura: Legislatura;
  dimensiones: { id: string; nombre: string; peso: number }[];
  metricas: { id: string; nombre: string; dimension: string; estado: string; unidad: string }[];
  grupos: { id: string; nombre: string; nombre_corto: string }[];
  periodos: PeriodoResumen[];
  filas: FilaRanking[];
}

export interface Metrica {
  id: string;
  dimension: string;
  estado: 'observado' | 'calculado' | 'no_disponible';
  valor: number | null;
  numerador: number | null;
  denominador: number | null;
  percentil: number | null;
  percentil_grupo: number | null;
  n_grupo: number | null;
  /** Which percentile enters the score (D-034). */
  comparacion?: 'camara' | 'grupo';
  motivo?: string;
  detalle?: Record<string, number>;
  fuente?: { nombre: string; url: string; fecha_dato: string | null };
}

export interface FichaPeriodo {
  estado: 'disponible' | 'no_disponible';
  motivo?: string | null;
  situacion?: 'ranking' | 'gobierno' | 'periodo_insuficiente';
  etapa_gobierno_excluida?: boolean;
  desde?: string | null;
  hasta?: string | null;
  dias_activo?: number;
  dias_gobierno?: number;
  dias_evaluados?: number;
  grupo?: string;
  roles?: string[];
  indice?: number | null;
  cobertura?: number | null;
  posicion?: number | null;
  total_ranking?: number;
  dimensiones?: { id: string; puntuacion: number | null }[];
  metricas?: Metrica[];
  /** Context: never part of the score (D-033). */
  tiempo_palabra?: { minutos: number; intervenciones: number; sin_hora: number };
}

export interface Ficha {
  metodologia_version: string;
  fecha_calculo: string;
  legislatura: Legislatura;
  diputado: {
    diputado_id: string;
    cod_parlamentario: number;
    nombre_completo: string;
    nombre: string;
    apellidos: string;
    slug: string;
    grupo: { id: string; nombre: string };
    formacion: string;
    partido: string;
    circunscripcion: string;
    fecha_alta: string;
    fecha_baja: string | null;
    url_ficha_oficial: string;
  };
  gobierno: { cargos: string; desde: string; hasta: string | null; evidencia: string[] }[];
  /** Bills of the legislature whose ponencia the deputy sat on. */
  ponencias: {
    iniciativa_id: string;
    tipo: string;
    titulo: string;
    resultado: string | null;
    fecha_resultado: string | null;
    url_fuente: string;
  }[];
  cargos: {
    organo_id: string;
    organo: string;
    tipo: string | null;
    cargo: string;
    desde: string;
    hasta: string | null;
  }[];
  periodos: Record<string, FichaPeriodo>;
  evolucion: { meses: string[]; series: Record<string, (number | null)[]> };
  ultimas_votaciones: {
    votacion_id: string;
    fecha: string | null;
    titulo: string | null;
    asunto: string | null;
    sentido: string;
    telematico: boolean;
    url_fuente: string | null;
  }[];
  ultimas_intervenciones: {
    intervencion_id: string;
    fecha: string;
    organo: string;
    tipo_iniciativa: string | null;
    cuenta: boolean;
    motivo_exclusion: string | null;
    url_fuente: string | null;
    url_video: string;
  }[];
}

export interface Meta {
  ejecutado: string;
  fecha_calculo: string;
  metodologia_version: string;
  commit: string | null;
  fuentes: { id: string; url: string; descargado: string; fecha_fichero: string | null }[];
  fechas_dato: Record<string, string>;
  registros: Record<string, number>;
  incidencias: {
    tipo: string;
    total_oficial: number;
    obtenidas: number;
    faltan: number;
    bloques_fallidos: number[];
    consultas_fallidas: string[];
  }[];
}

let rankingCache: Ranking | undefined;
export function loadRanking(): Ranking {
  rankingCache ??= read<Ranking>('ranking.json');
  return rankingCache;
}

let metaCache: Meta | undefined;
export function loadMeta(): Meta {
  metaCache ??= read<Meta>('meta.json');
  return metaCache;
}

export function fichaSlugs(): string[] {
  return readdirSync(join(DERIVED, 'diputados'))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -5))
    .sort();
}

export function loadFicha(slug: string): Ficha {
  return read<Ficha>('diputados', `${slug}.json`);
}

/** Raw text of a file of data/derived/, served as a download. */
export function derivedText(file: 'ranking.json' | 'meta.json'): string {
  return readFileSync(join(DERIVED, file), 'utf-8');
}

export interface TablaNormalizada {
  nombre: string;
  fichero: string;
  bytes: number;
  filas: number | null;
}

/** The normalized CSV tables with their size, for the downloads page. */
export function tablasNormalizadas(): TablaNormalizada[] {
  const dir = join(process.cwd(), 'data', 'normalized');
  const registros = loadMeta().registros;
  return readdirSync(dir)
    .filter((file) => file.endsWith('.csv'))
    .sort()
    .map((fichero) => {
      const nombre = fichero.slice(0, -4);
      return { nombre, fichero, bytes: statSync(join(dir, fichero)).size, filas: registros[nombre] ?? null };
    });
}
