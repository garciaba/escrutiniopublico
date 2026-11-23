/**
 * Scoring engine (specification, section 7). Pure functions: they take the normalized
 * tables, the scoring configuration and the calculation date, and return the results
 * of every period. No network, no clock, no files.
 */
import type { MetricEstado } from '../../config/scoring.ts';
import { daysInclusive, maxDate, minDate, overlapDays, periodWindow, type LegislaturaDates } from './dates.ts';
import { competitionRanks, mean, percentile, round } from './stats.ts';

export interface DiputadoIn {
  diputado_id: string;
  nombre_completo: string;
  grupo_id: string;
  fecha_alta: string;
  fecha_baja: string | undefined;
}
export interface VotacionIn {
  votacion_id: string;
  fecha: string;
}
export interface VotoIn {
  votacion_id: string;
  diputado_id: string;
  sentido: string;
  grupo_id: string;
}
export interface IntervencionIn {
  fecha: string;
  organo_id: string;
  diputado_id: string;
  cuenta: boolean;
  motivo_exclusion?: string | undefined;
  /** "HH:MM", official start and end of the speech; used for the speaking time, which never scores. */
  hora_inicio?: string | undefined;
  hora_fin?: string | undefined;
}
export interface OrganoIn {
  organo_id: string;
  tipo: string;
}
export interface IniciativaIn {
  iniciativa_id: string;
  tipo_codigo: string;
  fecha_presentacion: string | undefined;
  resultado?: string | undefined;
  fecha_resultado?: string | undefined;
  /** Bills: the Congreso's last vote; preferred to the outcome date, which is when the file closes. */
  fecha_conclusion?: string | undefined;
}
/** A rapporteur of a bill (D-033). */
export interface PonenteIn {
  iniciativa_id: string;
  diputado_id: string;
}
export interface FirmanteIn {
  iniciativa_id: string;
  diputado_id: string;
  orden: number;
  n_firmantes: number;
}
export interface PertenenciaIn {
  diputado_id: string;
  organo_id: string;
  cargo: string;
  fecha_inicio: string;
  fecha_fin: string | undefined;
}
/** Government term, half-open: [from, until). */
export interface GobiernoIn {
  diputado_id: string;
  from: string;
  until: string | undefined;
}

export interface Tables {
  diputados: readonly DiputadoIn[];
  votaciones: readonly VotacionIn[];
  votos: readonly VotoIn[];
  intervenciones: readonly IntervencionIn[];
  organos: readonly OrganoIn[];
  iniciativas: readonly IniciativaIn[];
  firmantes: readonly FirmanteIn[];
  ponentes: readonly PonenteIn[];
  pertenencias: readonly PertenenciaIn[];
  gobierno: readonly GobiernoIn[];
}

/** The parts of config/scoring.ts the engine needs (tests pass smaller ones). */
export interface ScoringInput {
  decimales: number;
  coberturaMinima: number;
  poblacionReferencia: { diasMinimos: number; proporcionMinimaPeriodo: number };
  periodos: readonly { id: string; nombre: string; dias: number | undefined }[];
  dimensiones: readonly { id: string; nombre: string; peso: number }[];
  metricas: readonly {
    id: string;
    dimension: string;
    estado: MetricEstado;
    motivo?: string;
    /** Signed initiatives of these types, with credit shared among the signers. */
    tiposIniciativa?: readonly string[];
    /** Outcomes (prefixes) that leave a signed initiative out of the metric. */
    excluirResultados?: readonly string[];
    /** Bills with one of these outcomes (prefixes) in whose ponencia the deputy sits. */
    resultadosPonencia?: readonly string[];
  }[];
  organosPorMetrica: Readonly<Record<string, readonly string[]>>;
}

export type Situacion = 'ranking' | 'gobierno' | 'periodo_insuficiente';

export interface MetricResult {
  id: string;
  dimension: string;
  estado: MetricEstado;
  valor: number | null;
  numerador: number | null;
  denominador: number | null;
  percentil: number | null;
  percentil_grupo: number | null;
  /** Deputies of the same group in the reference population with a value. */
  n_grupo: number | null;
  motivo?: string;
  detalle?: Record<string, number>;
}

/** Context figure of the profile; never part of the score. */
export interface TiempoPalabra {
  minutos: number;
  /** Speeches counted as the deputy's (formulated oral questions included). */
  intervenciones: number;
  /** Of those, speeches without official start or end time. */
  sin_hora: number;
}

export interface DeputyPeriod {
  diputado_id: string;
  situacion: Situacion;
  /** True when the deputy is ranked on the days outside the Government only. */
  etapa_gobierno_excluida: boolean;
  dias_activo: number;
  dias_gobierno: number;
  dias_evaluados: number;
  grupo_id: string;
  roles: string[];
  metricas: MetricResult[];
  dimensiones: Record<string, number | null>;
  indice: number | null;
  cobertura: number | null;
  posicion: number | null;
  tiempo_palabra: TiempoPalabra;
}

export interface PeriodResult {
  id: string;
  nombre: string;
  estado: 'disponible' | 'no_disponible';
  motivo?: string;
  desde?: string;
  hasta?: string;
  dias_minimos: number;
  poblacion_referencia: number;
  total_ranking: number;
  metricas_disponibles: string[];
  cobertura: number;
  diputados: DeputyPeriod[];
}

interface VoteEvent {
  fecha: string;
  emitido: boolean;
  grupo: string;
}
interface SpeechEvent {
  fecha: string;
  tipoOrgano: string;
}
export interface CreditEvent {
  fecha: string;
  tipo: string;
  n: number;
  primero: boolean;
  resultado: string;
}
/** A bill of the deputy's ponencia, dated by its outcome. */
export interface LawEvent {
  fecha: string;
  resultado: string;
}
interface TalkEvent {
  fecha: string;
  minutos: number | null;
}

/** Events grouped by deputy, built once and shared by every period. */
export interface Index {
  votes: Map<string, VoteEvent[]>;
  speeches: Map<string, SpeechEvent[]>;
  credits: Map<string, CreditEvent[]>;
  laws: Map<string, LawEvent[]>;
  talk: Map<string, TalkEvent[]>;
  gov: Map<string, GobiernoIn[]>;
  memberships: Map<string, PertenenciaIn[]>;
}

type MetricInput = ScoringInput['metricas'][number];

const startsWithAny = (text: string, prefixes: readonly string[]) => prefixes.some((prefix) => text.startsWith(prefix));

/** True when a signed initiative counts for a metric of signed initiatives. */
export function creditCounts(metric: MetricInput, event: CreditEvent): boolean {
  return (
    (metric.tiposIniciativa?.includes(event.tipo) ?? false) &&
    !startsWithAny(event.resultado, metric.excluirResultados ?? [])
  );
}

/** True when a bill of the deputy's ponencia counts for a metric of rapporteurships. */
export function lawCounts(metric: MetricInput, event: LawEvent): boolean {
  return metric.resultadosPonencia !== undefined && startsWithAny(event.resultado, metric.resultadosPonencia);
}

/** Minutes between two official "HH:MM" times; null when either is missing or malformed. */
export function minutesBetween(inicio: string | undefined, fin: string | undefined): number | null {
  const parse = (time: string | undefined) => {
    const match = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
    return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
  };
  const from = parse(inicio);
  const to = parse(fin);
  if (from === undefined || to === undefined) return null;
  // A speech that crosses midnight ends "earlier" than it starts.
  return to >= from ? to - from : to + 1440 - from;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function buildIndex(tables: Tables): Index {
  const index: Index = {
    votes: new Map(),
    speeches: new Map(),
    credits: new Map(),
    laws: new Map(),
    talk: new Map(),
    gov: new Map(),
    memberships: new Map(),
  };
  const voteDate = new Map(tables.votaciones.map((votacion) => [votacion.votacion_id, votacion.fecha]));
  for (const voto of tables.votos) {
    const fecha = voteDate.get(voto.votacion_id);
    if (fecha === undefined) throw new Error(`Vote ${voto.votacion_id} has rows but no header`);
    push(index.votes, voto.diputado_id, { fecha, emitido: voto.sentido !== 'no_vota', grupo: voto.grupo_id });
  }
  for (const events of index.votes.values())
    events.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));

  const organType = new Map(tables.organos.map((organo) => [organo.organo_id, organo.tipo]));
  for (const speech of tables.intervenciones) {
    // Speaking time covers every speech as a deputy, including one's own oral questions.
    if (speech.cuenta || speech.motivo_exclusion === 'pregunta_oral') {
      push(index.talk, speech.diputado_id, {
        fecha: speech.fecha,
        minutos: minutesBetween(speech.hora_inicio, speech.hora_fin),
      });
    }
    if (!speech.cuenta) continue;
    push(index.speeches, speech.diputado_id, {
      fecha: speech.fecha,
      tipoOrgano: organType.get(speech.organo_id) ?? '',
    });
  }

  const initiative = new Map(tables.iniciativas.map((row) => [row.iniciativa_id, row]));
  for (const signer of tables.firmantes) {
    const row = initiative.get(signer.iniciativa_id);
    if (!row?.fecha_presentacion) continue;
    push(index.credits, signer.diputado_id, {
      fecha: row.fecha_presentacion,
      tipo: row.tipo_codigo,
      n: signer.n_firmantes,
      primero: signer.orden === 1,
      resultado: row.resultado ?? '',
    });
  }
  for (const ponente of tables.ponentes) {
    const row = initiative.get(ponente.iniciativa_id);
    const fecha = row?.fecha_conclusion ?? row?.fecha_resultado;
    if (!row || !fecha) continue;
    push(index.laws, ponente.diputado_id, { fecha, resultado: row.resultado ?? '' });
  }
  for (const term of tables.gobierno) push(index.gov, term.diputado_id, term);
  for (const membership of tables.pertenencias) push(index.memberships, membership.diputado_id, membership);
  return index;
}

const FAR_FUTURE = '9999-12-31';

function inGovernment(terms: readonly GobiernoIn[], fecha: string): boolean {
  return terms.some((term) => term.from <= fecha && fecha < (term.until ?? FAR_FUTURE));
}

/** Days of [from, to] (inclusive) that fall inside half-open Government terms. */
function governmentDays(terms: readonly GobiernoIn[], from: string, to: string): number {
  let days = 0;
  for (const term of terms) {
    if (term.until !== undefined && term.until <= term.from) continue;
    const lastDay = term.until === undefined ? to : minDate(to, previousDay(term.until));
    days += overlapDays(term.from, lastDay, from, to);
  }
  return days;
}

function previousDay(iso: string): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
}

/** Minimum days in office to enter the reference population of a period. */
export function minimumDays(scoring: ScoringInput, periodDays: number | undefined): number {
  const { diasMinimos, proporcionMinimaPeriodo } = scoring.poblacionReferencia;
  return periodDays === undefined
    ? diasMinimos
    : Math.min(diasMinimos, Math.ceil(proporcionMinimaPeriodo * periodDays));
}

interface Raw {
  valor: number | null;
  numerador: number;
  denominador: number;
  detalle?: Record<string, number>;
}

interface Evaluation {
  baseDays: number;
  accept: (fecha: string) => boolean;
  votes: readonly VoteEvent[];
  speeches: readonly SpeechEvent[];
  credits: readonly CreditEvent[];
  laws: readonly LawEvent[];
}

function rawMetric(metric: MetricInput, scoring: ScoringInput, e: Evaluation): Raw {
  const per100 = (count: number): number | null => (e.baseDays > 0 ? (100 * count) / e.baseDays : null);
  if (metric.id === 'votaciones_participacion') {
    const votes = e.votes.filter((vote) => e.accept(vote.fecha));
    const cast = votes.filter((vote) => vote.emitido).length;
    return { valor: votes.length > 0 ? cast / votes.length : null, numerador: cast, denominador: votes.length };
  }
  const organTypes = scoring.organosPorMetrica[metric.id];
  if (organTypes) {
    const count = e.speeches.filter((s) => organTypes.includes(s.tipoOrgano) && e.accept(s.fecha)).length;
    return { valor: per100(count), numerador: count, denominador: e.baseDays };
  }
  if (metric.resultadosPonencia) {
    const count = e.laws.filter((law) => lawCounts(metric, law) && e.accept(law.fecha)).length;
    return { valor: per100(count), numerador: count, denominador: e.baseDays };
  }
  if (metric.tiposIniciativa) {
    const signed = e.credits.filter((c) => creditCounts(metric, c) && e.accept(c.fecha));
    const credit = round(
      signed.reduce((sum, c) => sum + 1 / c.n, 0),
      4,
    );
    return {
      valor: per100(credit),
      numerador: credit,
      denominador: e.baseDays,
      detalle: { firmadas: signed.length, primer_firmante: signed.filter((c) => c.primero).length },
    };
  }
  throw new Error(`Metric ${metric.id} is available in the configuration but has no implementation`);
}

/** True when the Chamber had any activity of the kind a metric measures inside the window. */
function chamberActivity(
  metric: MetricInput,
  scoring: ScoringInput,
  index: Index,
  desde: string,
  hasta: string,
): boolean {
  const inside = (fecha: string) => desde <= fecha && fecha <= hasta;
  const some = <T extends { fecha: string }>(map: Map<string, T[]>, test: (event: T) => boolean) => {
    for (const events of map.values()) if (events.some((event) => inside(event.fecha) && test(event))) return true;
    return false;
  };
  if (metric.id === 'votaciones_participacion') return some(index.votes, () => true);
  const organTypes = scoring.organosPorMetrica[metric.id];
  if (organTypes) return some(index.speeches, (speech) => organTypes.includes(speech.tipoOrgano));
  if (metric.resultadosPonencia) return some(index.laws, (law) => lawCounts(metric, law));
  if (metric.tiposIniciativa) return some(index.credits, (credit) => creditCounts(metric, credit));
  return false;
}

function rolesFor(memberships: readonly PertenenciaIn[], desde: string, hasta: string, inGov: boolean): string[] {
  const roles = new Set<string>();
  if (inGov) roles.add('gobierno');
  for (const membership of memberships) {
    if (overlapDays(membership.fecha_inicio, membership.fecha_fin ?? hasta, desde, hasta) === 0) continue;
    if (membership.organo_id === 'mesa') {
      roles.add('mesa');
      if (/^President/i.test(membership.cargo)) roles.add('presidencia');
    }
    if (membership.organo_id === 'junta-portavoces' && membership.cargo === 'Portavoces titulares')
      roles.add('portavoz');
  }
  return [...roles].sort();
}

interface Working extends DeputyPeriod {
  nombre: string;
  raw: Map<string, Raw>;
  pct: Map<string, number>;
}

export function computePeriod(
  tables: Tables,
  index: Index,
  scoring: ScoringInput,
  legislatura: LegislaturaDates,
  period: ScoringInput['periodos'][number],
  fechaCalculo: string,
): PeriodResult {
  const diasMinimos = minimumDays(scoring, period.dias);
  const totalWeight = scoring.dimensiones.reduce((sum, dimension) => sum + dimension.peso, 0);
  const base = { id: period.id, nombre: period.nombre, dias_minimos: diasMinimos };
  const unavailable = (motivo: string, window?: { desde: string; hasta: string }): PeriodResult => ({
    ...base,
    ...(window ?? {}),
    estado: 'no_disponible',
    motivo,
    poblacion_referencia: 0,
    total_ranking: 0,
    metricas_disponibles: [],
    cobertura: 0,
    diputados: [],
  });

  const window = periodWindow(period.dias, fechaCalculo, legislatura);
  if (!window) return unavailable('sin_dias_en_la_legislatura');
  const { desde, hasta } = window;
  if (window.dias < diasMinimos) return unavailable('periodo_demasiado_corto', { desde, hasta });

  const available = scoring.metricas.filter(
    (metric) => metric.estado !== 'no_disponible' && chamberActivity(metric, scoring, index, desde, hasta),
  );
  if (available.length === 0) return unavailable('sin_actividad_en_el_periodo', { desde, hasta });
  const availableIds = new Set(available.map((metric) => metric.id));

  const working: Working[] = [];
  for (const diputado of tables.diputados) {
    const activeFrom = maxDate(diputado.fecha_alta, desde);
    const activeTo = minDate(diputado.fecha_baja ?? hasta, hasta);
    const diasActivo = daysInclusive(activeFrom, activeTo);
    if (diasActivo === 0) continue;
    const terms = index.gov.get(diputado.diputado_id) ?? [];
    const diasGobierno = governmentDays(terms, activeFrom, activeTo);
    const diasOrdinarios = diasActivo - diasGobierno;
    // Ranked as an ordinary deputy only with enough days outside the Government, and
    // when those days are not fewer than the days inside it (decision D-024).
    const situacion: Situacion =
      diasOrdinarios >= diasMinimos && diasOrdinarios >= diasGobierno
        ? 'ranking'
        : diasGobierno > 0
          ? 'gobierno'
          : 'periodo_insuficiente';
    const excludeGov = situacion === 'ranking' && diasGobierno > 0;
    const votes = index.votes.get(diputado.diputado_id) ?? [];
    const evaluation: Evaluation = {
      baseDays: excludeGov ? diasOrdinarios : diasActivo,
      accept: (fecha) => activeFrom <= fecha && fecha <= activeTo && !(excludeGov && inGovernment(terms, fecha)),
      votes,
      speeches: index.speeches.get(diputado.diputado_id) ?? [],
      credits: index.credits.get(diputado.diputado_id) ?? [],
      laws: index.laws.get(diputado.diputado_id) ?? [],
    };
    const talk = (index.talk.get(diputado.diputado_id) ?? []).filter((event) => evaluation.accept(event.fecha));
    const raw = new Map(available.map((metric) => [metric.id, rawMetric(metric, scoring, evaluation)]));
    const lastVote = votes.filter((vote) => activeFrom <= vote.fecha && vote.fecha <= activeTo).at(-1);
    working.push({
      diputado_id: diputado.diputado_id,
      nombre: diputado.nombre_completo,
      situacion,
      etapa_gobierno_excluida: excludeGov,
      dias_activo: diasActivo,
      dias_gobierno: diasGobierno,
      dias_evaluados: evaluation.baseDays,
      grupo_id: lastVote?.grupo || diputado.grupo_id,
      roles: rolesFor(index.memberships.get(diputado.diputado_id) ?? [], desde, hasta, diasGobierno > 0),
      metricas: [],
      dimensiones: {},
      indice: null,
      cobertura: null,
      posicion: null,
      tiempo_palabra: {
        minutos: talk.reduce((sum, event) => sum + (event.minutos ?? 0), 0),
        intervenciones: talk.length,
        sin_hora: talk.filter((event) => event.minutos === null).length,
      },
      raw,
      pct: new Map(),
    });
  }

  const reference = working.filter((deputy) => deputy.situacion === 'ranking');
  if (reference.length === 0) return unavailable('sin_poblacion_de_referencia', { desde, hasta });

  // Percentiles against the reference population, in the Chamber and inside each group.
  const groupPct = new Map<string, Map<string, { pct: number; n: number }>>();
  for (const metric of available) {
    const values = (deputies: readonly Working[]) =>
      deputies
        .map((deputy) => deputy.raw.get(metric.id)?.valor)
        .filter((valor): valor is number => valor !== null && valor !== undefined)
        .sort((a, b) => a - b);
    const chamber = values(reference);
    const byGroup = new Map<string, number[]>();
    for (const group of new Set(reference.map((deputy) => deputy.grupo_id))) {
      byGroup.set(group, values(reference.filter((deputy) => deputy.grupo_id === group)));
    }
    for (const deputy of working) {
      const valor = deputy.raw.get(metric.id)?.valor;
      if (deputy.situacion === 'periodo_insuficiente' || valor === null || valor === undefined) continue;
      const pct = percentile(chamber, valor);
      if (pct !== undefined) deputy.pct.set(metric.id, pct);
      const groupValues = byGroup.get(deputy.grupo_id) ?? [];
      const inGroup = percentile(groupValues, valor);
      if (inGroup !== undefined) {
        const entry = groupPct.get(deputy.diputado_id) ?? new Map<string, { pct: number; n: number }>();
        entry.set(metric.id, { pct: inGroup, n: groupValues.length });
        groupPct.set(deputy.diputado_id, entry);
      }
    }
  }

  for (const deputy of working) {
    deputy.metricas = scoring.metricas.map((metric): MetricResult => {
      const empty = {
        valor: null,
        numerador: null,
        denominador: null,
        percentil: null,
        percentil_grupo: null,
        n_grupo: null,
      };
      if (metric.estado === 'no_disponible') {
        return {
          id: metric.id,
          dimension: metric.dimension,
          estado: 'no_disponible',
          ...empty,
          ...(metric.motivo ? { motivo: metric.motivo } : {}),
        };
      }
      const raw = deputy.raw.get(metric.id);
      if (!raw) {
        return {
          id: metric.id,
          dimension: metric.dimension,
          estado: 'no_disponible',
          ...empty,
          motivo: 'Sin actividad de la Cámara en el periodo.',
        };
      }
      const pct = deputy.pct.get(metric.id);
      const group = groupPct.get(deputy.diputado_id)?.get(metric.id);
      return {
        id: metric.id,
        dimension: metric.dimension,
        estado: raw.valor === null ? 'no_disponible' : metric.estado,
        valor: raw.valor === null ? null : round(raw.valor, 4),
        numerador: raw.numerador,
        denominador: raw.denominador,
        percentil: pct === undefined ? null : round(pct, 1),
        percentil_grupo: group ? round(group.pct, 1) : null,
        n_grupo: group ? group.n : null,
        ...(raw.valor === null ? { motivo: 'Sin oportunidad en el periodo.' } : {}),
        ...(raw.detalle ? { detalle: raw.detalle } : {}),
      };
    });
    if (deputy.situacion === 'periodo_insuficiente') {
      for (const dimension of scoring.dimensiones) deputy.dimensiones[dimension.id] = null;
      continue;
    }
    let weighted = 0;
    let weight = 0;
    for (const dimension of scoring.dimensiones) {
      const score = mean(
        scoring.metricas
          .filter((metric) => metric.dimension === dimension.id)
          .map((metric) => deputy.pct.get(metric.id))
          .filter((pct): pct is number => pct !== undefined),
      );
      deputy.dimensiones[dimension.id] = score === undefined ? null : round(score, scoring.decimales);
      if (score !== undefined) {
        weighted += dimension.peso * score;
        weight += dimension.peso;
      }
    }
    deputy.cobertura = round(weight / totalWeight, 4);
    // Compared in weight units to avoid a floating-point edge at exactly the minimum.
    deputy.indice =
      weight > 0 && weight >= scoring.coberturaMinima * totalWeight - 1e-9
        ? round(weighted / weight, scoring.decimales)
        : null;
  }

  const ranked = working
    .filter((deputy) => deputy.situacion === 'ranking' && deputy.indice !== null)
    .sort((a, b) => (b.indice ?? 0) - (a.indice ?? 0) || a.nombre.localeCompare(b.nombre, 'es'));
  competitionRanks(ranked.map((deputy) => deputy.indice ?? 0)).forEach((rank, i) => {
    const deputy = ranked[i];
    if (deputy) deputy.posicion = rank;
  });

  const coveredWeight = scoring.dimensiones
    .filter((dimension) =>
      scoring.metricas.some((metric) => metric.dimension === dimension.id && availableIds.has(metric.id)),
    )
    .reduce((sum, dimension) => sum + dimension.peso, 0);

  return {
    ...base,
    estado: 'disponible',
    desde,
    hasta,
    poblacion_referencia: reference.length,
    total_ranking: ranked.length,
    metricas_disponibles: available.map((metric) => metric.id),
    cobertura: round(coveredWeight / totalWeight, 4),
    diputados: working
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((deputy): DeputyPeriod => ({
        diputado_id: deputy.diputado_id,
        situacion: deputy.situacion,
        etapa_gobierno_excluida: deputy.etapa_gobierno_excluida,
        dias_activo: deputy.dias_activo,
        dias_gobierno: deputy.dias_gobierno,
        dias_evaluados: deputy.dias_evaluados,
        grupo_id: deputy.grupo_id,
        roles: deputy.roles,
        metricas: deputy.metricas,
        dimensiones: deputy.dimensiones,
        indice: deputy.indice,
        cobertura: deputy.cobertura,
        posicion: deputy.posicion,
        tiempo_palabra: deputy.tiempo_palabra,
      })),
  };
}

export function computeAllPeriods(
  tables: Tables,
  scoring: ScoringInput,
  legislatura: LegislaturaDates,
  fechaCalculo: string,
): PeriodResult[] {
  const index = buildIndex(tables);
  return scoring.periodos.map((period) => computePeriod(tables, index, scoring, legislatura, period, fechaCalculo));
}
