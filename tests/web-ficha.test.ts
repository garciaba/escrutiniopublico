/** Texts of a deputy's profile and geometry of its charts. Every person and figure is fictitious. */
import { describe, expect, it } from 'vitest';

import { scoring, type MetricConfig } from '../config/scoring.ts';
import type { Ficha, FichaPeriodo, Metrica } from '../web/src/lib/data.ts';
import {
  descripcionFicha,
  intervalo,
  periodoPrincipal,
  recortar,
  resumenEvolucion,
  valorBruto,
  valorMensual,
} from '../web/src/lib/ficha.ts';
import { sparkBars } from '../web/src/lib/sparkline.ts';

function config(id: string): MetricConfig {
  const found = scoring.metricas.find((metrica) => metrica.id === id);
  if (!found) throw new Error(`unknown metric ${id}`);
  return found;
}

function metrica(parcial: Partial<Metrica>): Metrica {
  return {
    id: 'votaciones_participacion',
    dimension: 'dedicacion',
    estado: 'observado',
    valor: null,
    numerador: null,
    denominador: null,
    percentil: null,
    percentil_grupo: null,
    n_grupo: null,
    ...parcial,
  };
}

const ficha = {
  legislatura: { numero: 99, nombre: 'XCIX', inicio: '2024-01-01', fin: null, finalizada: false },
  diputado: { nombre: 'Persona', apellidos: 'Ficticia Uno', circunscripcion: 'Ninguna' },
  periodos: {
    legislatura: { estado: 'no_disponible', motivo: 'sin_dias_en_activo' },
    '12m': { estado: 'disponible', situacion: 'ranking', indice: 53, posicion: 1160, total_ranking: 2392 },
  },
} as unknown as Ficha;

describe('valorBruto', () => {
  it('writes a proportion with its numerator and denominator', () => {
    const bruto = valorBruto(
      metrica({ valor: 0.9643, numerador: 1187, denominador: 1231 }),
      config('votaciones_participacion'),
    );
    expect(bruto).toEqual({
      principal: '1.187 de 1.231 votaciones',
      secundario: 'Participó en el 96,4 % de las votaciones en cuya lista figura.',
    });
  });

  it('writes a count with the days it is divided by, in singular when it is one', () => {
    expect(
      valorBruto(metrica({ valor: 0.0872, numerador: 1, denominador: 1147 }), config('intervenciones_pleno')),
    ).toEqual({
      principal: '1 intervención',
      secundario: 'En 1.147 días en activo: 0,09 por cada 100 días.',
    });
    expect(
      valorBruto(metrica({ valor: 100, numerador: 1, denominador: 1 }), config('intervenciones_comision'))?.secundario,
    ).toBe('En 1 día en activo: 100 por cada 100 días.');
  });

  it('explains the fractional credit of signed initiatives', () => {
    const bruto = valorBruto(
      metrica({
        estado: 'calculado',
        valor: 7.8202,
        numerador: 89.6981,
        denominador: 1147,
        detalle: { firmadas: 738, primer_firmante: 73 },
      }),
      config('preguntas_escritas'),
    );
    expect(bruto?.principal).toBe('738 preguntas firmadas');
    expect(bruto?.secundario).toBe(
      '73 como primer firmante. Repartidas entre sus firmantes equivalen a 89,7 en 1.147 días en activo: 7,82 por cada 100 días.',
    );
    expect(
      valorBruto(
        metrica({ valor: 1, numerador: 1, denominador: 100, detalle: { firmadas: 1, primer_firmante: 1 } }),
        config('solicitudes_informe'),
      )?.principal,
    ).toBe('1 solicitud firmada');
  });

  it('writes approved bills of the ponencia in singular and plural', () => {
    expect(valorBruto(metrica({ valor: 0.0872, numerador: 1, denominador: 1147 }), config('leyes_ponente'))).toEqual({
      principal: '1 ley aprobada',
      secundario: 'En 1.147 días en activo: 0,09 por cada 100 días.',
    });
    expect(valorMensual(2, config('leyes_ponente'))).toBe('2 leyes aprobadas');
  });

  it('writes oral questions like written ones, with the fractional credit', () => {
    const bruto = valorBruto(
      metrica({ valor: 3.5, numerador: 40.5, denominador: 1147, detalle: { firmadas: 41, primer_firmante: 40 } }),
      config('preguntas_orales'),
    );
    expect(bruto?.principal).toBe('41 preguntas firmadas');
  });

  it('returns nothing when there is no value: not available is never a zero', () => {
    expect(valorBruto(metrica({ estado: 'no_disponible' }), config('iniciativas_aprobadas'))).toBeUndefined();
    expect(
      valorBruto(
        metrica({ estado: 'no_disponible', numerador: 0, denominador: 0 }),
        config('votaciones_participacion'),
      ),
    ).toBeUndefined();
  });

  it('keeps a real zero as a zero, without a rate that adds nothing', () => {
    expect(valorBruto(metrica({ valor: 0, numerador: 0, denominador: 21 }), config('intervenciones_pleno'))).toEqual({
      principal: '0 intervenciones',
      secundario: 'En 21 días en activo.',
    });
    expect(
      valorBruto(
        metrica({ valor: 0, numerador: 0, denominador: 21, detalle: { firmadas: 0, primer_firmante: 0 } }),
        config('preguntas_escritas'),
      ),
    ).toEqual({ principal: '0 preguntas firmadas', secundario: 'En 21 días en activo.' });
  });
});

describe('monthly evolution', () => {
  it('describes one month', () => {
    expect(valorMensual(1, config('votaciones_participacion'))).toBe('100 % de participación');
    expect(valorMensual(1, config('intervenciones_pleno'))).toBe('1 intervención');
    expect(valorMensual(3, config('intervenciones_pleno'))).toBe('3 intervenciones');
    expect(valorMensual(2.6607, config('preguntas_escritas'))).toBe('2,66 preguntas');
  });

  it('summarizes a series for the text alternative of the chart', () => {
    const meses = ['2024-01', '2024-02', '2024-03'];
    expect(resumenEvolucion([0, 4, 1], meses, config('intervenciones_pleno'))).toBe(
      'Evolución mensual de enero de 2024 a marzo de 2024: máximo de 4 intervenciones en febrero de 2024.',
    );
    expect(resumenEvolucion([null, 0.5, 1], meses, config('votaciones_participacion'))).toBe(
      'Evolución mensual de febrero de 2024 a marzo de 2024: entre el 50 % (febrero de 2024) y el 100 %.',
    );
    expect(resumenEvolucion([0, 0, 0], meses, config('intervenciones_pleno'))).toBe(
      'Evolución mensual de enero de 2024 a marzo de 2024: sin actividad en ningún mes.',
    );
    expect(resumenEvolucion([null, null, null], meses, config('intervenciones_pleno'))).toBe('Sin datos mensuales.');
  });

  it('draws one column per month with activity and leaves gaps for the rest', () => {
    const barras = sparkBars([0, 2, null, 4], ['2024-01', '2024-02', '2024-03', '2024-04'], { width: 32, height: 32 });
    expect(barras.map((barra) => barra.mes)).toEqual(['2024-02', '2024-04']);
    expect(barras[1]).toEqual({ x: 25, y: 0, width: 6, height: 32, mes: '2024-04', valor: 4 });
    expect(barras[0]).toMatchObject({ x: 9, y: 16, height: 16 });
  });

  it('marks a month with votes and none cast when asked, on a fixed scale', () => {
    const barras = sparkBars([0, 0.5, null], ['2024-01', '2024-02', '2024-03'], {
      width: 24,
      height: 32,
      max: 1,
      marcarCeros: true,
    });
    expect(barras.map((barra) => [barra.mes, barra.height])).toEqual([
      ['2024-01', 1],
      ['2024-02', 16],
    ]);
  });

  it('draws nothing for an empty series', () => {
    expect(sparkBars([], [], { width: 0, height: 32 })).toEqual([]);
  });
});

describe('small texts', () => {
  it('writes an interval of dates, open or closed', () => {
    expect(intervalo('2023-08-17', '2026-10-06')).toBe('del 17 de agosto de 2023 al 6 de octubre de 2026');
    expect(intervalo('2023-08-17', null)).toBe('desde el 17 de agosto de 2023');
  });

  it('cuts long official texts at a word boundary', () => {
    expect(recortar('Texto corto.', 40)).toBe('Texto corto.');
    expect(recortar('Dictamen de la Comisión sobre el proyecto de ley, con enmiendas', 50)).toBe(
      'Dictamen de la Comisión sobre el proyecto de ley…',
    );
    expect(recortar('a'.repeat(30), 10)).toBe(`${'a'.repeat(10)}…`);
  });
});

describe('profile', () => {
  const orden = ['legislatura', '12m', '3m'];

  it('opens with the first available period in the configured order', () => {
    expect(periodoPrincipal(ficha, orden)?.id).toBe('12m');
    expect(periodoPrincipal({ ...ficha, periodos: {} }, orden)).toBeUndefined();
  });

  it('describes a ranked deputy with index and position', () => {
    const periodo = ficha.periodos['12m'];
    expect(descripcionFicha(ficha, periodo, 'Alfa')).toBe(
      'Actividad parlamentaria de Persona Ficticia Uno (Alfa, Ninguna) en la XCIX Legislatura: índice 53,0 de 100, n.º 1.160 de 2.392. Votaciones, intervenciones y preguntas con datos oficiales del Congreso.',
    );
  });

  it('gives no index in the description of a deputy outside the ranking', () => {
    const fuera: FichaPeriodo = { estado: 'disponible', situacion: 'gobierno', indice: 9.5, posicion: null };
    expect(descripcionFicha(ficha, fuera, 'Alfa')).not.toContain('índice');
    expect(descripcionFicha(ficha, undefined, 'Alfa')).toContain('Persona Ficticia Uno (Alfa, Ninguna)');
  });
});
