/**
 * Bodies of the Congreso. The composition exports give each committee an official
 * name and code; the interventions file writes the same bodies with abbreviated
 * labels. Labels that do not match an official name exactly are mapped here by
 * hand (reviewed on 2026-11-23 against the 64 official names of the XV).
 */

export type OrganoTipo =
  | 'pleno'
  | 'diputacion_permanente'
  | 'mesa'
  | 'junta_portavoces'
  | 'comision'
  | 'comision_mixta'
  | 'comision_investigacion'
  | 'subcomision'
  | 'sesion_conjunta';

/** Bodies that are not in the committee exports. */
export const fixedBodies: readonly { id: string; nombre: string; tipo: OrganoTipo }[] = [
  { id: 'pleno', nombre: 'Pleno', tipo: 'pleno' },
  { id: 'diputacion-permanente', nombre: 'Diputación Permanente', tipo: 'diputacion_permanente' },
  { id: 'sesion-conjunta', nombre: 'Sesión Conjunta', tipo: 'sesion_conjunta' },
];

/** Interventions label (line breaks collapsed) -> official name or fixed body name. */
export const interventionOrganLabels: Readonly<Record<string, string>> = {
  'Comisión de Trabajo, Eco. Social, Inclusión, S.Social y Migraciones':
    'Comisión de Trabajo, Economía Social, Inclusión, Seguridad Social y Migraciones',
  'Comisión Mixta Control Parlam. de la Corporación RTVE y sus Sociedades':
    'Comisión Mixta de Control Parlamentario de la Corporación RTVE y sus Sociedades',
  'Comisión Mixta para Coordinación y Seguimiento Estrategia Española ODS':
    'Comisión Mixta para la Coordinación y Seguimiento de la Estrategia Española para alcanzar los Objetivos de Desarrollo Sostenible (ODS)',
  'Comisión de seguimiento y evaluación de los acuerdos Pacto de Toledo':
    'Comisión de seguimiento y evaluación de los acuerdos del Pacto de Toledo',
  'Comisión de segto. y eval. acuerdos Pacto de Estado Violencia Género':
    'Comisión de seguimiento y evaluación de los acuerdos del Pacto de Estado en materia de Violencia de Género',
  'Comisión calidad democrática, contra corrupción y reform. inst. y leg.':
    'Comisión para la auditoría de la calidad democrática, la lucha contra la corrupción y las reformas institucionales y legales',
  '(152/1) Comisión de Investigación sobre "Operación Cataluña"':
    'Comisión de Investigación sobre la denominada "Operación Cataluña" y las actuaciones del Ministerio del Interior durante los gobiernos del Partido Popular en relación con las presuntas irregularidades que vinculan a altos cargos y mandos policiales con la existencia de una trama parapolicial',
  '(152/2) Comisión de Investigación atentados de Barcelona y Cambrils':
    'Comisión de Investigación sobre el derecho a saber la verdad y las implicaciones derivadas de los atentados de Barcelona y Cambrils del 17 de agosto de 2017',
  '(152/4) Comisión Investigación contratación material sanitario COVID19':
    'Comisión de Investigación sobre los hechos, responsabilidades y enseñanzas en torno a los procesos de contratación para la adquisición de material sanitario por parte de las Administraciones públicas durante la crisis pandémica ocasionada por la COVID-19',
  '(152/5) Comisión Investigación sobre la DANA y paliar fenómenos futuro':
    'Comisión de Investigación sobre la gestión de la crisis derivada de la DANA que tuvo lugar el 29 de octubre de 2024, así como para el estudio y propuesta de medidas de mejora destinadas a paliar los efectos de estos fenómenos adversos en el futuro',
  // Three committees on the blackout of 28/04/2025 exist. This label repeats the exact
  // wording of committee 362 (constituted 12/02/2026; its sessions start in May 2026).
  '(152/8) Com.Investig. interrup. suminis. eléctrico el 28 abril de 2025':
    'Comisión de Investigación de la interrupción del suministro eléctrico el 28 de abril de 2025',
};

/** Classifies an official committee name. */
export function organoTipoFromName(nombre: string): OrganoTipo {
  if (nombre === 'Pleno') return 'pleno';
  if (nombre === 'Diputación Permanente') return 'diputacion_permanente';
  if (nombre === 'Mesa del Congreso') return 'mesa';
  if (nombre === 'Junta de Portavoces') return 'junta_portavoces';
  if (nombre === 'Sesión Conjunta') return 'sesion_conjunta';
  if (/^Subcomisi[oó]n|^Ponencia|^Grupo de trabajo/i.test(nombre)) return 'subcomision';
  if (/^Comisi[oó]n de Investigaci[oó]n/i.test(nombre)) return 'comision_investigacion';
  if (/^Comisi[oó]n Mixta/i.test(nombre)) return 'comision_mixta';
  return 'comision';
}
