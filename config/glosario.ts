/**
 * Terms explained in a small pop-up wherever they appear (decision D-038). One
 * sentence each; the long explanation lives in /metodologia.
 */
export interface Glosa {
  id: string;
  termino: string;
  texto: string;
}

export const glosario: readonly Glosa[] = [
  {
    id: 'percentil',
    termino: 'Percentil',
    texto:
      'Porcentaje de diputados con un valor inferior. 50 es la mediana; 90 significa que solo uno de cada diez tiene más.',
  },
  {
    id: 'cobertura',
    termino: 'Cobertura',
    texto:
      'Parte del índice que tiene datos oficiales detrás. Las dimensiones sin fuente quedan fuera del cálculo: no cuentan como cero.',
  },
];
