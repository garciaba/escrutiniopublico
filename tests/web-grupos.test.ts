/** Texts and scales of the /grupos page. Every figure is fictitious. */
import { describe, expect, it } from 'vitest';

import type { Agregado } from '../web/src/lib/data.ts';
import {
  anchoBarra,
  escala,
  fueraDelCalculo,
  nDiputados,
  resumenDistribucion,
  unidadAgregada,
  valorAgregado,
} from '../web/src/lib/grupos.ts';

function agregado(parcial: Partial<Agregado>): Agregado {
  return {
    id: 'GX',
    nombre: 'Grupo Equis',
    nombre_corto: 'Equis',
    diputados: 8,
    gobierno: 0,
    periodo_insuficiente: 0,
    dias_evaluados: 800,
    indice: { min: 30, p25: 43.6, mediana: 53.3, p75: 60, max: 66.5 },
    dimensiones: [],
    metricas: [],
    tiempo_palabra: { minutos: 0, intervenciones: 0, minutos_por_100_dias: 0 },
    ...parcial,
  };
}

describe('figures', () => {
  it('prints proportions as percentages and rates with the decimals their size needs', () => {
    expect(valorAgregado(0.9934, 'proporcion')).toBe('99,3 %');
    expect(valorAgregado(17.6149, 'por_100_dias')).toBe('17,6');
    expect(valorAgregado(0.6575, 'por_100_dias')).toBe('0,66');
    expect(valorAgregado(0.0542, 'por_100_dias')).toBe('0,05');
    expect(valorAgregado(112.08, 'minutos')).toBe('112,1');
  });

  it('says what each kind of figure means', () => {
    expect(unidadAgregada('proporcion')).toMatch(/Votos emitidos/);
    expect(unidadAgregada('por_100_dias')).toBe('Por diputado, cada 100 días en activo');
  });

  it('counts deputies in singular and plural', () => {
    expect(nDiputados(1)).toBe('1 diputado');
    expect(nDiputados(1150)).toBe('1.150 diputados');
  });
});

describe('bars', () => {
  it('scales each metric to its highest value, and proportions to the whole', () => {
    expect(escala([0.5, 2, null, 1], 'por_100_dias')).toBe(2);
    expect(escala([0.9, 0.99], 'proporcion')).toBe(1);
    expect(escala([null, undefined], 'por_100_dias')).toBe(0);
  });

  it('never hides a real value and never draws a zero', () => {
    expect(anchoBarra(1, 2)).toBe(50);
    expect(anchoBarra(2, 2)).toBe(100);
    expect(anchoBarra(0.001, 100)).toBe(1);
    expect(anchoBarra(0, 100)).toBe(0);
    expect(anchoBarra(5, 0)).toBe(0);
  });
});

describe('who is left out', () => {
  it('lists members of the Government and deputies with too few days', () => {
    expect(fueraDelCalculo({ gobierno: 15, periodo_insuficiente: 2 })).toBe(
      '15 miembros del Gobierno y 2 con periodo insuficiente',
    );
    expect(fueraDelCalculo({ gobierno: 1, periodo_insuficiente: 0 })).toBe('1 miembro del Gobierno');
    expect(fueraDelCalculo({ gobierno: 0, periodo_insuficiente: 0 })).toBe('');
  });
});

describe('text alternative of a strip', () => {
  it('gives the range, the median and the central half', () => {
    expect(resumenDistribucion(agregado({}), 5)).toBe(
      'Equis: índice de sus 8 diputados, de 30,0 a 66,5; mediana 53,3; la mitad central, entre 43,6 y 60,0.',
    );
  });

  it('leaves the central half out of small groups', () => {
    expect(resumenDistribucion(agregado({ diputados: 3 }), 5)).toBe(
      'Equis: índice de sus 3 diputados, de 30,0 a 66,5; mediana 53,3.',
    );
  });

  it('handles a single deputy and a group without index', () => {
    const uno = agregado({ diputados: 1, indice: { min: 64.9, p25: 64.9, mediana: 64.9, p75: 64.9, max: 64.9 } });
    expect(resumenDistribucion(uno, 5)).toBe('Equis: un diputado, con índice 64,9.');
    expect(resumenDistribucion(agregado({ diputados: 0, indice: null }), 5)).toBe(
      'Equis: ningún diputado con índice en el periodo.',
    );
  });
});
