/** Texts and choices of a deputy's profile. Pure functions, covered by tests. */
import type { MetricConfig } from '../../../config/scoring.ts';
import type { Ficha, FichaPeriodo, Metrica } from './data.ts';
import { fechaLarga, mes, num, numFlexible, plural, porcentaje } from './format.ts';

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

/** Meta description of a profile. */
export function descripcionFicha(ficha: Ficha, principal: FichaPeriodo | undefined, grupoCorto: string): string {
  const { nombre, apellidos, circunscripcion } = ficha.diputado;
  const quien = `${nombre} ${apellidos} (${grupoCorto}, ${circunscripcion})`;
  const legislatura = `${ficha.legislatura.nombre} Legislatura`;
  if (principal?.situacion === 'ranking' && principal.indice != null && principal.posicion != null) {
    return `Actividad parlamentaria de ${quien} en la ${legislatura}: índice ${num(principal.indice, 1)} de 100, n.º ${num(principal.posicion)} de ${num(principal.total_ranking ?? 0)}. Votaciones, intervenciones y preguntas con datos oficiales del Congreso.`;
  }
  return `Actividad parlamentaria de ${quien} en la ${legislatura}: votaciones, intervenciones y preguntas con datos oficiales del Congreso.`;
}
