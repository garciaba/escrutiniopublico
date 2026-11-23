/**
 * Public log of data changes and rectifications, shown on /cambios next to the
 * methodology versions (config/scoring.ts) and the manual corrections
 * (config/overrides.ts). Newest first. Add an entry whenever a rectification is
 * accepted or a reload changes published figures for a reason other than new activity.
 */

export interface EntradaRegistro {
  /** yyyy-mm-dd */
  fecha: string;
  tipo: 'datos' | 'rectificacion';
  texto: string;
}

export const registro: readonly EntradaRegistro[] = [
  {
    fecha: '2026-11-23',
    tipo: 'datos',
    texto:
      'Primera carga completa de la XV Legislatura: votaciones nominales del Pleno, intervenciones, preguntas con respuesta escrita, solicitudes de informe y composición de los órganos.',
  },
];
