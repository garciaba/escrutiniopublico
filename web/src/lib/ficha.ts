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

/** Text of one month of a sparkline, for its tooltip. */
export function valorMensual(valor: number, config: MetricConfig): string {
  if (config.unidad === 'proporcion') return `${porcentaje(valor, 0)} de participación`;
  const [singular, variosObjetos] = config.objeto;
  return `${numFlexible(valor, 2)} ${Number.isInteger(valor) ? plural(valor, singular, variosObjetos) : variosObjetos}`;
}

/** Text alternative of a sparkline: range of months, peak and how many months have data. */
export function resumenEvolucion(
  valores: readonly (number | null)[],
  meses: readonly string[],
  config: MetricConfig,
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
