/** Spanish formatting helpers. Deterministic: no locale or time zone of the machine is used. */

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** 1187 -> "1.187"; 96.4 -> "96,4" (always with thousands separator). */
export function num(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [integer = '0', fraction] = fixed.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = value < 0 && Number(fixed) !== 0 ? '−' : '';
  return `${sign}${grouped}${fraction ? `,${fraction}` : ''}`;
}

/** Trims needless decimals: 233.5 -> "233,5"; 6 -> "6". */
export function numFlexible(value: number, maxDecimals = 1): string {
  const rounded = Number(value.toFixed(maxDecimals));
  return num(rounded, Number.isInteger(rounded) ? 0 : maxDecimals);
}

/** 0.964 -> "96,4 %" */
export function porcentaje(ratio: number, decimals = 1): string {
  return `${num(ratio * 100, decimals)} %`;
}

/** "2026-10-06" -> "6 de octubre de 2026" */
export function fechaLarga(iso: string): string {
  const [year = '', month = '1', day = '1'] = iso.slice(0, 10).split('-');
  return `${Number(day)} de ${MESES[Number(month) - 1] ?? ''} de ${year}`;
}

/** "2026-10-06" -> "06/10/2026" */
export function fechaCorta(iso: string): string {
  const [year = '', month = '', day = ''] = iso.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

/** "2026-10" -> "octubre de 2026"; short: "oct 2026" */
export function mes(yearMonth: string, short = false): string {
  const [year = '', month = '1'] = yearMonth.split('-');
  const name = MESES[Number(month) - 1] ?? '';
  return short ? `${name.slice(0, 3)} ${year}` : `${name} de ${year}`;
}

/** "Abascal Conde, Santiago" -> "Santiago Abascal Conde" */
export function nombreNatural(censusName: string): string {
  const [apellidos = '', nombre = ''] = censusName.split(',', 2).map((part) => part.trim());
  return `${nombre} ${apellidos}`.trim();
}

/** Initials for the avatar: first given name and first surname. */
export function iniciales(nombre: string, apellidos: string): string {
  const first = (text: string) => (text.trim()[0] ?? '').toUpperCase();
  return `${first(nombre)}${first(apellidos)}`;
}

/** Lower case without accents, for searching names. */
export function sinAcentos(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

export function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

const ROLES: Readonly<Record<string, string>> = {
  gobierno: 'Gobierno',
  presidencia: 'Presidencia',
  mesa: 'Mesa',
  portavoz: 'Portavoz',
};

export function rolEtiqueta(role: string): string {
  return ROLES[role] ?? role;
}

const MOTIVOS: Readonly<Record<string, string>> = {
  periodo_demasiado_corto: 'La legislatura terminó y el periodo no tiene días suficientes.',
  sin_dias_en_la_legislatura: 'La legislatura terminó antes de este periodo.',
  sin_actividad_en_el_periodo: 'No hubo actividad parlamentaria en este periodo.',
  sin_poblacion_de_referencia: 'Ningún diputado reúne los días mínimos en este periodo.',
  sin_dias_en_activo: 'No fue diputado en este periodo.',
};

export function motivoPeriodo(motivo: string | null | undefined): string {
  return (motivo && MOTIVOS[motivo]) || 'No disponible.';
}

const EXCLUSIONES: Readonly<Record<string, string>> = {
  fuera_de_mandato: 'Fuera de su mandato',
  diputacion_permanente: 'Diputación Permanente',
  cargo_gobierno: 'Como miembro del Gobierno',
  cargo_externo: 'Con un cargo externo',
};

export function motivoExclusion(motivo: string | null | undefined): string {
  return (motivo && EXCLUSIONES[motivo]) || '';
}

const SENTIDOS: Readonly<Record<string, string>> = {
  si: 'Sí',
  no: 'No',
  abstencion: 'Abstención',
  no_vota: 'No vota',
};

export function sentidoVoto(sentido: string): string {
  return SENTIDOS[sentido] ?? sentido;
}

/** 9521519 -> "9,1 MB"; 514 -> "514 B". */
export function tamano(bytes: number): string {
  if (bytes < 1024) return `${num(bytes)} B`;
  if (bytes < 1024 * 1024) return `${num(Math.round(bytes / 1024))} kB`;
  return `${num(bytes / (1024 * 1024), 1)} MB`;
}
