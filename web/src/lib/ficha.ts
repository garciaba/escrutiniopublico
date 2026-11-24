/** Texts and choices of a deputy's profile. Pure functions, covered by tests. */
import type { MetricConfig } from '../../../config/scoring.ts';
import type { Ficha, FichaPeriodo, Metrica } from './data.ts';
import { fechaLarga, mes, nombreCircunscripcion, num, numFlexible, plural, porcentaje } from './format.ts';

/** The first available period, in the order of the configuration: the one the profile opens with. */
export function periodoPrincipal(
  ficha: Ficha,
  orden: readonly string[],
): { id: string; periodo: FichaPeriodo } | undefined {
  for (const id of orden) {
    const periodo = ficha.periodos[id];
    if (periodo?.estado === 'disponible') return { id, periodo };
  }
  return undefined;
}

export interface Bruto {
  /** The headline figure with its denominator: "2.171 de 2.173 votaciones". */
  principal: string;
  /** How it becomes the value that is ranked. */
  secundario: string;
}

/** Raw value of a metric in words. Undefined when the metric has no value. */
export function valorBruto(metrica: Metrica, config: MetricConfig): Bruto | undefined {
  const { valor, numerador, denominador, detalle } = metrica;
  if (valor === null || numerador === null || denominador === null) return undefined;
  const [singular, variosObjetos] = config.objeto;
  const objeto = (count: number) => plural(count, singular, variosObjetos);
  const dias = `${num(denominador)} ${plural(denominador, 'día', 'días')} en activo`;
  const tasa = `${numFlexible(valor, 2)} por cada 100 días`;
  if (config.unidad === 'proporcion') {
    return {
      principal: `${num(numerador)} de ${num(denominador)} ${objeto(denominador)}`,
      secundario: `Participó en el ${porcentaje(valor)} de las votaciones en cuya lista figura.`,
    };
  }
  if (detalle && detalle.firmadas !== undefined) {
    const firmadas = detalle.firmadas;
    const primero = detalle.primer_firmante ?? 0;
    return {
      principal: `${num(firmadas)} ${objeto(firmadas)} ${plural(firmadas, 'firmada', 'firmadas')}`,
      secundario:
        firmadas === 0
          ? `En ${dias}.`
          : `${num(primero)} como primer firmante. Repartidas entre sus firmantes equivalen a ${numFlexible(numerador, 1)} en ${dias}: ${tasa}.`,
    };
  }
  return {
    principal: `${num(numerador)} ${objeto(numerador)}`,
    secundario: numerador === 0 ? `En ${dias}.` : `En ${dias}: ${tasa}.`,
  };
}

/** What a monthly value needs to be put in words; the browser gets it as data attributes. */
export type UnidadMensual = Pick<MetricConfig, 'unidad' | 'objeto'>;

/** Text of one month of a monthly chart, for its read-out. */
export function valorMensual(valor: number, config: UnidadMensual): string {
  if (config.unidad === 'proporcion') return `${porcentaje(valor, 0)} de participación`;
  const [singular, variosObjetos] = config.objeto;
  return `${numFlexible(valor, 2)} ${Number.isInteger(valor) ? plural(valor, singular, variosObjetos) : variosObjetos}`;
}

/** "marzo de 2025: 4 intervenciones"; a month without data says so. */
export function lecturaMensual(yearMonth: string, valor: number | null, config: UnidadMensual): string {
  return `${mes(yearMonth)}: ${valor === null ? 'sin datos' : valorMensual(valor, config)}`;
}

/** Months of a series that fall inside a period, both ends included. */
export function serieDelPeriodo(
  valores: readonly (number | null)[],
  meses: readonly string[],
  desde: string | null | undefined,
  hasta: string | null | undefined,
): { valores: (number | null)[]; meses: string[] } {
  const primero = desde ? desde.slice(0, 7) : '';
  const ultimo = hasta ? hasta.slice(0, 7) : '9999-12';
  const dentro = meses.flatMap((yearMonth, i) => (yearMonth >= primero && yearMonth <= ultimo ? [i] : []));
  return { valores: dentro.map((i) => valores[i] ?? null), meses: dentro.map((i) => meses[i] ?? '') };
}

/**
 * "3,0,,5": the values of a series for a data attribute; an empty field is a month
 * without data. A chart has two months or more, so the empty text is the empty series.
 */
export function codificarSerie(valores: readonly (number | null)[]): string {
  return valores.map((valor) => (valor === null ? '' : String(Math.round(valor * 10000) / 10000))).join(',');
}

export function descodificarSerie(texto: string): (number | null)[] {
  return texto === '' ? [] : texto.split(',').map((campo) => (campo === '' ? null : Number(campo)));
}

/** "2023-08" plus two months is "2023-10". */
export function mesSiguiente(yearMonth: string, pasos: number): string {
  const [year = '0', month = '1'] = yearMonth.split('-');
  const total = Number(year) * 12 + (Number(month) - 1) + pasos;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Text alternative of a monthly chart: range of months and peak. */
export function resumenEvolucion(
  valores: readonly (number | null)[],
  meses: readonly string[],
  config: UnidadMensual,
): string {
  const conDato = valores.flatMap((valor, i) => (valor === null ? [] : [{ valor, mes: meses[i] ?? '' }]));
  if (conDato.length === 0) return 'Sin datos mensuales.';
  const primero = conDato[0];
  const ultimo = conDato[conDato.length - 1];
  const maximo = conDato.reduce((best, item) => (item.valor > best.valor ? item : best));
  const rango = `Evolución mensual de ${mes(primero?.mes ?? '')} a ${mes(ultimo?.mes ?? '')}`;
  if (maximo.valor === 0) return `${rango}: sin actividad en ningún mes.`;
  if (config.unidad === 'proporcion') {
    const minimo = conDato.reduce((best, item) => (item.valor < best.valor ? item : best));
    return `${rango}: entre el ${porcentaje(minimo.valor, 0)} (${mes(minimo.mes)}) y el ${porcentaje(maximo.valor, 0)}.`;
  }
  return `${rango}: máximo de ${valorMensual(maximo.valor, config)} en ${mes(maximo.mes)}.`;
}

/** "del 17 de agosto de 2023 al 6 de octubre de 2026" / "desde el 17 de agosto de 2023". */
export function intervalo(desde: string, hasta: string | null | undefined): string {
  return hasta ? `del ${fechaLarga(desde)} al ${fechaLarga(hasta)}` : `desde el ${fechaLarga(desde)}`;
}

/** Cuts a long official text at a word boundary. */
export function recortar(texto: string, max: number): string {
  if (texto.length <= max) return texto;
  const corte = texto.lastIndexOf(' ', max);
  return `${texto.slice(0, corte > max * 0.6 ? corte : max).replace(/[\s,;:.]+$/, '')}…`;
}

/** The period a profile opens with, as `periodoPrincipal` returns it. */
export interface Principal {
  id: string;
  periodo: FichaPeriodo;
}

/** "2023-2026", or "desde 2023" while the legislature is running. */
export function anosLegislatura(ficha: Ficha): string {
  const inicio = ficha.legislatura.inicio.slice(0, 4);
  return ficha.legislatura.fin ? `${inicio}-${ficha.legislatura.fin.slice(0, 4)}` : `desde ${inicio}`;
}

/** Votes and speeches of a period, when the period has them. */
export function cifrasClave(periodo: FichaPeriodo | undefined): {
  votos?: { emitidos: number; total: number };
  intervenciones?: number;
} {
  const metrica = (id: string) => periodo?.metricas?.find((item) => item.id === id);
  const votos = metrica('votaciones_participacion');
  const habladas = ['intervenciones_pleno', 'intervenciones_comision']
    .map((id) => metrica(id)?.numerador)
    .filter((valor): valor is number => typeof valor === 'number');
  return {
    ...(votos?.numerador != null && votos.denominador != null && votos.denominador > 0
      ? { votos: { emitidos: votos.numerador, total: votos.denominador } }
      : {}),
    ...(habladas.length > 0 ? { intervenciones: habladas.reduce((suma, valor) => suma + valor, 0) } : {}),
  };
}

/**
 * One sentence at the top of a profile, the one search engines and assistants quote:
 * who, for where, when, and the two figures anyone understands. It never says
 * "diputado" or "diputada": the data do not record gender and it is not guessed.
 */
export function resumenFicha(ficha: Ficha, principal: Principal | undefined): string {
  const { partido, circunscripcion, fecha_alta, fecha_baja } = ficha.diputado;
  const cuando = fecha_baja
    ? `de ${mes(fecha_alta.slice(0, 7))} a ${mes(fecha_baja.slice(0, 7))}`
    : `desde ${mes(fecha_alta.slice(0, 7))}`;
  const quien = `Miembro del Congreso por ${nombreCircunscripcion(circunscripcion)} (${partido}) ${cuando}.`;
  const { votos, intervenciones } = cifrasClave(principal?.periodo);
  if (!votos && intervenciones === undefined) return quien;
  const periodo =
    principal?.id === 'legislatura' ? 'la legislatura' : `el ${nombrePeriodo(principal?.id).toLowerCase()}`;
  const voto = votos
    ? `votó en ${num(votos.emitidos)} de las ${num(votos.total)} ${plural(votos.total, 'votación', 'votaciones')} del Pleno que le correspondían`
    : '';
  const habla =
    intervenciones === undefined
      ? ''
      : intervenciones === 0
        ? 'no consta ninguna intervención suya'
        : `intervino ${num(intervenciones)} ${plural(intervenciones, 'vez', 'veces')}`;
  const union = voto && habla ? (intervenciones === 0 ? '; ' : ' e ') : '';
  return `${quien} En ${periodo} ${voto}${union}${habla}.`;
}

function nombrePeriodo(id: string | undefined): string {
  const nombres: Readonly<Record<string, string>> = {
    legislatura: 'Legislatura',
    '12m': 'Último año',
    '3m': 'Último trimestre',
    '1m': 'Último mes',
  };
  return (id && nombres[id]) || 'periodo';
}

/** Longest title before search engines start to cut it, roughly. */
const TITULO_MAX = 65;
/** Longest meta description before search engines start to cut it, roughly. */
const DESCRIPCION_MAX = 160;

/** Title of a profile: the name first, then what the page offers; the years go if they do not fit. */
export function tituloFicha(ficha: Ficha): string {
  const { nombre, apellidos, partido } = ficha.diputado;
  const titulo = `${nombre} ${apellidos} (${partido}): actividad en el Congreso`;
  const conAnos = `${titulo} ${anosLegislatura(ficha)}`;
  return conAnos.length <= TITULO_MAX ? conAnos : titulo;
}

/** Meta description of a profile: the figures themselves, not a description of them. */
export function descripcionFicha(ficha: Ficha, principal: Principal | undefined): string {
  const { nombre, apellidos, partido, circunscripcion } = ficha.diputado;
  const quien = `${nombre} ${apellidos} (${partido}, ${nombreCircunscripcion(circunscripcion)})`;
  const cuando = principal?.id === 'legislatura' || !principal ? `en ${anosLegislatura(ficha)}` : 'en el último año';
  const { votos, intervenciones } = cifrasClave(principal?.periodo);
  const habla = intervenciones ? `intervino ${num(intervenciones)} ${plural(intervenciones, 'vez', 'veces')}` : '';
  const hechos = votos
    ? `votó en ${num(votos.emitidos)} de ${num(votos.total)} votaciones del Pleno${habla ? ` e ${habla}` : ''} ${cuando}`
    : habla
      ? `${habla} ${cuando}`
      : '';
  if (!hechos) {
    return `${quien}: votaciones, intervenciones y preguntas en el Congreso ${anosLegislatura(ficha)}, con datos oficiales.`;
  }
  const periodo = principal?.periodo;
  const indice =
    periodo?.situacion === 'ranking' && periodo.indice != null
      ? ` Índice: ${num(periodo.indice, 1)}/100.`
      : periodo?.situacion === 'gobierno'
        ? ' Fuera del ranking por su etapa en el Gobierno.'
        : '';
  const texto = `${quien} ${hechos}.${indice}`;
  // The closing words are the first to go when the description is long.
  const completo = `${texto} Datos del Congreso.`;
  return completo.length <= DESCRIPCION_MAX ? completo : texto;
}
