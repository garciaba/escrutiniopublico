/**
 * Aggregates by parliamentary group and by electoral list (decision D-037), for the
 * /grupos page. Pure function over the engine results: it adds up the published
 * figures of the ranked deputies and summarizes how their indices are spread. It
 * computes no score and no position for a group.
 */
import type { MetricEstado } from '../../config/scoring.ts';
import { header, type DeriveInput } from './derive.ts';
import type { DeputyPeriod, PeriodResult } from './engine.ts';
import { quantile, round } from './stats.ts';

export type GruposInput = Pick<
  DeriveInput,
  'scoring' | 'legislatura' | 'fechaCalculo' | 'periods' | 'diputados' | 'grupos'
>;

export interface MetricaAgregada {
  id: string;
  estado: MetricEstado;
  /** Sum of the numerators of the deputies (votes cast, speeches, fractional credit…). */
  total: number | null;
  /** Sum of their denominators: votes whose roster lists them, or days in office. */
  denominador: number | null;
  /** total ÷ denominador, as a proportion or per 100 days, like the metric of a deputy. */
  valor: number | null;
}

export interface Agregado {
  id: string;
  nombre: string;
  nombre_corto: string;
  /** Electoral lists only: the census formations grouped under the name. */
  formaciones?: string[];
  /** Ranked deputies: the only ones that count in the figures below. */
  diputados: number;
  /** Deputies left out, as in the ranking. */
  gobierno: number;
  periodo_insuficiente: number;
  dias_evaluados: number;
  /** Spread of the indices of the ranked deputies; null when none has an index. */
  indice: { min: number; p25: number; mediana: number; p75: number; max: number } | null;
  dimensiones: { id: string; mediana: number | null }[];
  metricas: MetricaAgregada[];
  /** Context, never scored. */
  tiempo_palabra: { minutos: number; intervenciones: number; minutos_por_100_dias: number | null };
}

export interface PeriodoGrupos {
  id: string;
  nombre: string;
  estado: 'disponible' | 'no_disponible';
  motivo: string | null;
  desde: string | null;
  hasta: string | null;
  camara: Agregado | null;
  grupos: Agregado[];
  candidaturas: Agregado[];
}

const ascending = (a: number, b: number) => a - b;

function median(values: (number | null | undefined)[], decimals: number): number | null {
  const sorted = values.filter((value): value is number => value != null).sort(ascending);
  const value = quantile(sorted, 0.5);
  return value === undefined ? null : round(value, decimals);
}

function aggregate(
  identity: Pick<Agregado, 'id' | 'nombre' | 'nombre_corto' | 'formaciones'>,
  members: readonly DeputyPeriod[],
  period: PeriodResult,
  scoring: GruposInput['scoring'],
): Agregado {
  const ranked = members.filter((deputy) => deputy.situacion === 'ranking');
  const dias = ranked.reduce((sum, deputy) => sum + deputy.dias_evaluados, 0);
  const indices = ranked
    .map((deputy) => deputy.indice)
    .filter((indice): indice is number => indice !== null)
    .sort(ascending);
  const at = (p: number) => round(quantile(indices, p) ?? 0, scoring.decimales);

  const metricas = scoring.metricas.map((metric): MetricaAgregada => {
    const rows = period.metricas_disponibles.includes(metric.id)
      ? ranked.flatMap((deputy) => {
          const found = deputy.metricas.find((candidate) => candidate.id === metric.id);
          return found && found.valor !== null ? [found] : [];
        })
      : [];
    const total = rows.reduce((sum, row) => sum + (row.numerador ?? 0), 0);
    const denominador = rows.reduce((sum, row) => sum + (row.denominador ?? 0), 0);
    if (rows.length === 0 || denominador === 0) {
      return { id: metric.id, estado: 'no_disponible', total: null, denominador: null, valor: null };
    }
    const ratio = total / denominador;
    return {
      id: metric.id,
      estado: metric.estado,
      total: round(total, 4),
      denominador,
      valor: round(metric.unidad === 'proporcion' ? ratio : 100 * ratio, 4),
    };
  });

  const minutos = ranked.reduce((sum, deputy) => sum + deputy.tiempo_palabra.minutos, 0);
  return {
    ...identity,
    diputados: ranked.length,
    gobierno: members.filter((deputy) => deputy.situacion === 'gobierno').length,
    periodo_insuficiente: members.filter((deputy) => deputy.situacion === 'periodo_insuficiente').length,
    dias_evaluados: dias,
    indice: indices.length === 0 ? null : { min: at(0), p25: at(0.25), mediana: at(0.5), p75: at(0.75), max: at(1) },
    dimensiones: scoring.dimensiones.map((dimension) => ({
      id: dimension.id,
      mediana: median(
        ranked.map((deputy) => deputy.dimensiones[dimension.id]),
        scoring.decimales,
      ),
    })),
    metricas,
    tiempo_palabra: {
      minutos,
      intervenciones: ranked.reduce((sum, deputy) => sum + deputy.tiempo_palabra.intervenciones, 0),
      minutos_por_100_dias: dias > 0 ? round((100 * minutos) / dias, 2) : null,
    },
  };
}

/** Largest first, as the Congreso lists its groups; ties by name. */
function bySize(a: Agregado, b: Agregado): number {
  return (
    b.diputados - a.diputados ||
    b.gobierno + b.periodo_insuficiente - (a.gobierno + a.periodo_insuficiente) ||
    a.nombre_corto.localeCompare(b.nombre_corto, 'es')
  );
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const list = map.get(key(item));
    if (list) list.push(item);
    else map.set(key(item), [item]);
  }
  return map;
}

export function buildGrupos(input: GruposInput) {
  const { scoring } = input;
  const groupNames = new Map(input.grupos.map((grupo) => [grupo.grupo_id, grupo]));
  const census = new Map(input.diputados.map((diputado) => [diputado.diputado_id, diputado]));

  const periodos = input.periods.map((period): PeriodoGrupos => {
    const base = {
      id: period.id,
      nombre: period.nombre,
      estado: period.estado,
      motivo: period.motivo ?? null,
      desde: period.desde ?? null,
      hasta: period.hasta ?? null,
    };
    if (period.estado !== 'disponible') return { ...base, camara: null, grupos: [], candidaturas: [] };

    const grupos = [...groupBy(period.diputados, (deputy) => deputy.grupo_id)].map(([id, members]) => {
      const names = groupNames.get(id);
      return aggregate(
        { id, nombre: names?.nombre ?? id, nombre_corto: names?.nombre_corto ?? id },
        members,
        period,
        scoring,
      );
    });
    const candidaturas = [...groupBy(period.diputados, (deputy) => census.get(deputy.diputado_id)?.partido ?? '')].map(
      ([id, members]) => {
        const formaciones = [...new Set(members.map((deputy) => census.get(deputy.diputado_id)?.formacion ?? ''))].sort(
          (a, b) => a.localeCompare(b, 'es'),
        );
        return aggregate({ id, nombre: id, nombre_corto: id, formaciones }, members, period, scoring);
      },
    );
    return {
      ...base,
      camara: aggregate(
        { id: 'camara', nombre: 'Congreso de los Diputados', nombre_corto: 'Toda la Cámara' },
        period.diputados,
        period,
        scoring,
      ),
      grupos: grupos.sort(bySize),
      candidaturas: candidaturas.sort(bySize),
    };
  });

  return { ...header(input), periodos };
}
