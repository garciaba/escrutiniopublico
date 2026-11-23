/**
 * Builds the JSON the website consumes (specification, section 5): the ranking, one
 * profile per deputy and the run metadata. Pure functions over the engine results.
 */
import { minDate, monthsBetween } from './dates.ts';
import type {
  DeputyPeriod,
  DiputadoIn,
  GobiernoIn,
  Index,
  IntervencionIn,
  MetricResult,
  OrganoIn,
  PeriodResult,
  PertenenciaIn,
  ScoringInput,
  VotacionIn,
  VotoIn,
} from './engine.ts';
import { round } from './stats.ts';

export interface DiputadoFull extends DiputadoIn {
  cod_parlamentario: number;
  nombre: string;
  apellidos: string;
  slug: string;
  formacion: string;
  partido: string;
  circunscripcion: string;
  url_ficha_oficial: string;
}
export interface VotacionFull extends VotacionIn {
  titulo: string;
  texto_expediente: string;
  url_fuente: string;
}
export interface VotoFull extends VotoIn {
  telematico: boolean;
}
export interface IntervencionFull extends IntervencionIn {
  intervencion_id: string;
  tipo_iniciativa: string | undefined;
  motivo_exclusion: string | undefined;
  url_fuente: string | undefined;
  url_video: string;
}
export interface OrganoFull extends OrganoIn {
  nombre: string;
}
export interface GrupoFull {
  grupo_id: string;
  nombre: string;
  nombre_corto: string;
}
export interface GobiernoFull extends GobiernoIn {
  posts: string;
  evidence: readonly string[];
}

/** config/scoring.ts with the texts the outputs repeat. */
export interface ScoringTexts extends ScoringInput {
  metodologiaVersion: string;
  metricas: readonly (ScoringInput['metricas'][number] & { nombre: string; unidad: string; fuente?: string })[];
  fuentes: Readonly<Record<string, { nombre: string; url: string }>>;
}

export interface DeriveInput {
  scoring: ScoringTexts;
  legislatura: { number: number; roman: string; inicio: string; fin: string | undefined };
  fechaCalculo: string;
  periods: readonly PeriodResult[];
  index: Index;
  diputados: readonly DiputadoFull[];
  grupos: readonly GrupoFull[];
  organos: readonly OrganoFull[];
  pertenencias: readonly PertenenciaIn[];
  votaciones: readonly VotacionFull[];
  votos: readonly VotoFull[];
  intervenciones: readonly IntervencionFull[];
  gobierno: readonly GobiernoFull[];
  /** Source id (config/scoring.ts `fuentes`) -> date of its data, yyyy-mm-dd. */
  fechasFuente: Readonly<Record<string, string>>;
  limites: { ultimasVotaciones: number; ultimasIntervenciones: number };
}

function header(input: DeriveInput) {
  const { legislatura } = input;
  return {
    metodologia_version: input.scoring.metodologiaVersion,
    fecha_calculo: input.fechaCalculo,
    legislatura: {
      numero: legislatura.number,
      nombre: legislatura.roman,
      inicio: legislatura.inicio,
      fin: legislatura.fin ?? null,
      finalizada: legislatura.fin !== undefined && legislatura.fin <= input.fechaCalculo,
    },
  };
}

function periodSummary(period: PeriodResult) {
  return {
    id: period.id,
    nombre: period.nombre,
    estado: period.estado,
    motivo: period.motivo ?? null,
    desde: period.desde ?? null,
    hasta: period.hasta ?? null,
    dias_minimos: period.dias_minimos,
    poblacion_referencia: period.poblacion_referencia,
    total_ranking: period.total_ranking,
    cobertura: period.cobertura,
    metricas_disponibles: period.metricas_disponibles,
  };
}

export interface RankingRow {
  periodo: string;
  slug: string;
  nombre: string;
  grupo: string;
  partido: string;
  circunscripcion: string;
  roles: string[];
  situacion: string;
  indice: number | null;
  cobertura: number | null;
  posicion: number | null;
  dimensiones: Record<string, number | null>;
}

export function buildRanking(input: DeriveInput) {
  const byId = new Map(input.diputados.map((diputado) => [diputado.diputado_id, diputado]));
  const filas: RankingRow[] = [];
  for (const period of input.periods) {
    for (const deputy of period.diputados) {
      const diputado = byId.get(deputy.diputado_id);
      if (!diputado) throw new Error(`Unknown deputy in results: ${deputy.diputado_id}`);
      filas.push({
        periodo: period.id,
        slug: diputado.slug,
        nombre: diputado.nombre_completo,
        grupo: deputy.grupo_id,
        partido: diputado.partido,
        circunscripcion: diputado.circunscripcion,
        roles: deputy.roles,
        situacion: deputy.situacion,
        indice: deputy.indice,
        cobertura: deputy.cobertura,
        posicion: deputy.posicion,
        dimensiones: deputy.dimensiones,
      });
    }
  }
  return {
    ...header(input),
    dimensiones: input.scoring.dimensiones.map(({ id, nombre, peso }) => ({ id, nombre, peso })),
    metricas: input.scoring.metricas.map(({ id, nombre, dimension, estado, unidad }) => ({
      id,
      nombre,
      dimension,
      estado,
      unidad,
    })),
    grupos: input.grupos.map(({ grupo_id, nombre, nombre_corto }) => ({ id: grupo_id, nombre, nombre_corto })),
    periodos: input.periods.map(periodSummary),
    filas,
  };
}

/** One row per line, so the daily git diff of the ranking stays readable. */
export function serializeRanking(ranking: ReturnType<typeof buildRanking>): string {
  const { filas, ...rest } = ranking;
  const head = JSON.stringify(rest, null, 1).replace(/\n}$/, '');
  return `${head},\n "filas": [\n${filas.map((fila) => `  ${JSON.stringify(fila)}`).join(',\n')}\n ]\n}\n`;
}

function metricOut(metric: MetricResult, input: DeriveInput) {
  const config = input.scoring.metricas.find((candidate) => candidate.id === metric.id);
  const source = config?.fuente ? input.scoring.fuentes[config.fuente] : undefined;
  return {
    ...metric,
    ...(source && config?.fuente
      ? { fuente: { nombre: source.nombre, url: source.url, fecha_dato: input.fechasFuente[config.fuente] ?? null } }
      : {}),
  };
}

function deputyPeriodOut(period: PeriodResult, deputy: DeputyPeriod, input: DeriveInput) {
  return {
    situacion: deputy.situacion,
    etapa_gobierno_excluida: deputy.etapa_gobierno_excluida,
    desde: period.desde ?? null,
    hasta: period.hasta ?? null,
    dias_activo: deputy.dias_activo,
    dias_gobierno: deputy.dias_gobierno,
    dias_evaluados: deputy.dias_evaluados,
    grupo: deputy.grupo_id,
    roles: deputy.roles,
    indice: deputy.indice,
    cobertura: deputy.cobertura,
    posicion: deputy.posicion,
    total_ranking: period.total_ranking,
    dimensiones: input.scoring.dimensiones.map((dimension) => ({
      id: dimension.id,
      puntuacion: deputy.dimensiones[dimension.id] ?? null,
    })),
    metricas: deputy.metricas.map((metric) => metricOut(metric, input)),
  };
}

/** Monthly series of every available metric, for the sparklines of the profile. */
function evolution(diputado: DiputadoFull, input: DeriveInput) {
  const { legislatura, scoring, index } = input;
  const last = legislatura.fin === undefined ? input.fechaCalculo : minDate(input.fechaCalculo, legislatura.fin);
  const meses = monthsBetween(legislatura.inicio, last);
  const position = new Map(meses.map((mes, i) => [mes, i]));
  const inMandate = (fecha: string) =>
    diputado.fecha_alta <= fecha && fecha <= (diputado.fecha_baja ?? last) && fecha <= last;
  const zeros = () => meses.map(() => 0);
  const series: Record<string, (number | null)[]> = {};
  for (const metric of scoring.metricas) {
    if (metric.estado === 'no_disponible') continue;
    const add = (target: number[], fecha: string, amount: number) => {
      const i = position.get(fecha.slice(0, 7));
      if (i !== undefined && inMandate(fecha)) target[i] = (target[i] ?? 0) + amount;
    };
    const organTypes = scoring.organosPorMetrica[metric.id];
    if (metric.id === 'votaciones_participacion') {
      const cast = zeros();
      const listed = zeros();
      for (const vote of index.votes.get(diputado.diputado_id) ?? []) {
        add(listed, vote.fecha, 1);
        if (vote.emitido) add(cast, vote.fecha, 1);
      }
      series[metric.id] = meses.map((_, i) =>
        (listed[i] ?? 0) > 0 ? round((cast[i] ?? 0) / (listed[i] ?? 1), 4) : null,
      );
    } else if (organTypes) {
      const counts = zeros();
      for (const speech of index.speeches.get(diputado.diputado_id) ?? []) {
        if (organTypes.includes(speech.tipoOrgano)) add(counts, speech.fecha, 1);
      }
      series[metric.id] = counts;
    } else if (metric.tipoIniciativa) {
      const credit = zeros();
      for (const event of index.credits.get(diputado.diputado_id) ?? []) {
        if (event.tipo === metric.tipoIniciativa) add(credit, event.fecha, 1 / event.n);
      }
      series[metric.id] = credit.map((value) => round(value, 4));
    }
  }
  return { meses, series };
}

export function buildFichas(input: DeriveInput): Map<string, object> {
  const organo = new Map(input.organos.map((row) => [row.organo_id, row]));
  const grupo = new Map(input.grupos.map((row) => [row.grupo_id, row]));
  const votacion = new Map(input.votaciones.map((row) => [row.votacion_id, row]));
  const group = <T extends { diputado_id: string }>(rows: readonly T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) {
      const list = map.get(row.diputado_id);
      if (list) list.push(row);
      else map.set(row.diputado_id, [row]);
    }
    return map;
  };
  const votos = group(input.votos);
  const intervenciones = group(input.intervenciones);
  const pertenencias = group(input.pertenencias);
  const gobierno = group(input.gobierno);
  const desc = (a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0);

  const fichas = new Map<string, object>();
  for (const diputado of input.diputados) {
    const id = diputado.diputado_id;
    const periodos: Record<string, object> = {};
    for (const period of input.periods) {
      const deputy = period.diputados.find((candidate) => candidate.diputado_id === id);
      periodos[period.id] = deputy
        ? { estado: period.estado, ...deputyPeriodOut(period, deputy, input) }
        : {
            estado: 'no_disponible',
            motivo: period.estado === 'no_disponible' ? (period.motivo ?? null) : 'sin_dias_en_activo',
          };
    }
    const ultimasVotaciones = (votos.get(id) ?? [])
      .map((voto) => ({ voto, cabecera: votacion.get(voto.votacion_id) }))
      .sort(
        (a, b) =>
          desc(a.cabecera?.fecha ?? '', b.cabecera?.fecha ?? '') || desc(a.voto.votacion_id, b.voto.votacion_id),
      )
      .slice(0, input.limites.ultimasVotaciones)
      .map(({ voto, cabecera }) => ({
        votacion_id: voto.votacion_id,
        fecha: cabecera?.fecha ?? null,
        titulo: cabecera?.titulo ?? null,
        asunto: cabecera?.texto_expediente ?? null,
        sentido: voto.sentido,
        telematico: voto.telematico,
        url_fuente: cabecera?.url_fuente ?? null,
      }));
    const ultimasIntervenciones = (intervenciones.get(id) ?? [])
      .slice()
      .sort((a, b) => desc(a.fecha, b.fecha) || desc(a.intervencion_id, b.intervencion_id))
      .slice(0, input.limites.ultimasIntervenciones)
      .map((row) => ({
        intervencion_id: row.intervencion_id,
        fecha: row.fecha,
        organo: organo.get(row.organo_id)?.nombre ?? row.organo_id,
        tipo_iniciativa: row.tipo_iniciativa ?? null,
        cuenta: row.cuenta,
        motivo_exclusion: row.motivo_exclusion ?? null,
        url_fuente: row.url_fuente ?? null,
        url_video: row.url_video,
      }));
    fichas.set(diputado.slug, {
      ...header(input),
      diputado: {
        diputado_id: id,
        cod_parlamentario: diputado.cod_parlamentario,
        nombre_completo: diputado.nombre_completo,
        nombre: diputado.nombre,
        apellidos: diputado.apellidos,
        slug: diputado.slug,
        grupo: { id: diputado.grupo_id, nombre: grupo.get(diputado.grupo_id)?.nombre ?? diputado.grupo_id },
        formacion: diputado.formacion,
        partido: diputado.partido,
        circunscripcion: diputado.circunscripcion,
        fecha_alta: diputado.fecha_alta,
        fecha_baja: diputado.fecha_baja ?? null,
        url_ficha_oficial: diputado.url_ficha_oficial,
      },
      gobierno: (gobierno.get(id) ?? []).map((term) => ({
        cargos: term.posts,
        desde: term.from,
        hasta: term.until ?? null,
        evidencia: term.evidence,
      })),
      cargos: (pertenencias.get(id) ?? [])
        .map((row) => ({
          organo_id: row.organo_id,
          organo: organo.get(row.organo_id)?.nombre ?? row.organo_id,
          tipo: organo.get(row.organo_id)?.tipo ?? null,
          cargo: row.cargo,
          desde: row.fecha_inicio,
          hasta: row.fecha_fin ?? null,
        }))
        .sort(
          (a, b) =>
            a.organo.localeCompare(b.organo, 'es') ||
            a.desde.localeCompare(b.desde) ||
            a.cargo.localeCompare(b.cargo, 'es'),
        ),
      periodos,
      evolucion: evolution(diputado, input),
      ultimas_votaciones: ultimasVotaciones,
      ultimas_intervenciones: ultimasIntervenciones,
    });
  }
  return fichas;
}

export interface MetaInput {
  /** ISO timestamp of the run (read from the clock by the orchestrator). */
  ejecutado: string;
  commit: string | null;
  fuentes: readonly { id: string; url: string; descargado: string; fecha_fichero: string | null }[];
  registros: Readonly<Record<string, number>>;
  incidencias: readonly unknown[];
}

export function buildMeta(input: DeriveInput, meta: MetaInput) {
  return {
    ejecutado: meta.ejecutado,
    ...header(input),
    commit: meta.commit,
    periodos: input.periods.map(periodSummary),
    fuentes: meta.fuentes,
    fechas_dato: input.fechasFuente,
    registros: meta.registros,
    incidencias: meta.incidencias,
  };
}
