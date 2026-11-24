/** Spanish formatting helpers of the website. */
import { describe, expect, it } from 'vitest';

import {
  duracion,
  fechaCorta,
  fechaLarga,
  iniciales,
  mes,
  motivoExclusion,
  motivoPeriodo,
  nombreCircunscripcion,
  nombreNatural,
  num,
  numFlexible,
  plural,
  porcentaje,
  rolEtiqueta,
  sentidoVoto,
  sinAcentos,
  tamano,
} from '../web/src/lib/format.ts';

describe('numbers', () => {
  it('always groups thousands with a dot and uses a decimal comma', () => {
    expect(num(1187)).toBe('1.187');
    expect(num(760518)).toBe('760.518');
    expect(num(96.44, 1)).toBe('96,4');
    expect(num(53, 1)).toBe('53,0');
    expect(num(0)).toBe('0');
  });

  it('writes negative numbers with a minus sign, never a negative zero', () => {
    expect(num(-1234.5, 1)).toBe('−1.234,5');
    expect(num(-0.01, 1)).toBe('0,0');
  });

  it('drops decimals that add nothing', () => {
    expect(numFlexible(6)).toBe('6');
    expect(numFlexible(233.5)).toBe('233,5');
    expect(numFlexible(7.8202, 2)).toBe('7,82');
    expect(numFlexible(2, 2)).toBe('2');
  });

  it('formats proportions as percentages with a space before the sign', () => {
    expect(porcentaje(0.964)).toBe('96,4 %');
    expect(porcentaje(0.6, 0)).toBe('60 %');
    expect(porcentaje(1, 0)).toBe('100 %');
  });

  it('formats speaking time in hours and minutes', () => {
    expect(duracion(0)).toBe('0 min');
    expect(duracion(45)).toBe('45 min');
    expect(duracion(120)).toBe('2 h');
    expect(duracion(755)).toBe('12 h 35 min');
    expect(duracion(60_125)).toBe('1.002 h 5 min');
  });

  it('formats file sizes', () => {
    expect(tamano(514)).toBe('514 B');
    expect(tamano(150473)).toBe('147 kB');
    expect(tamano(9521519)).toBe('9,1 MB');
  });
});

describe('dates', () => {
  it('formats ISO dates without depending on the time zone of the machine', () => {
    expect(fechaLarga('2026-10-06')).toBe('6 de octubre de 2026');
    expect(fechaLarga('2026-11-23T12:56:38.248Z')).toBe('23 de noviembre de 2026');
    expect(fechaCorta('2023-08-17')).toBe('17/08/2023');
  });

  it('formats months', () => {
    expect(mes('2025-03')).toBe('marzo de 2025');
    expect(mes('2023-08', true)).toBe('ago 2023');
  });
});

describe('names and labels', () => {
  it('turns the census order into the natural one', () => {
    expect(nombreNatural('Ficticio Uno, Persona')).toBe('Persona Ficticio Uno');
    expect(nombreNatural('Sin Coma')).toBe('Sin Coma');
  });

  it('takes the initials of the first given name and the first surname', () => {
    expect(iniciales('María del Mar', 'Ficticio Uno')).toBe('MF');
    expect(iniciales('àgueda', 'ficticio')).toBe('ÀF');
  });

  it('folds accents and case for searching', () => {
    expect(sinAcentos('Àgueda MICÓ Núñez')).toBe('agueda mico nunez');
  });

  it('chooses singular or plural', () => {
    expect(plural(1, 'día', 'días')).toBe('día');
    expect(plural(0, 'día', 'días')).toBe('días');
  });

  it('labels roles, reasons and votes, with a fallback for unknown codes', () => {
    expect(rolEtiqueta('mesa')).toBe('Mesa');
    expect(rolEtiqueta('otro')).toBe('otro');
    expect(motivoPeriodo('sin_dias_en_activo')).toBe('No fue diputado en este periodo.');
    expect(motivoPeriodo(null)).toBe('No disponible.');
    expect(motivoExclusion('diputacion_permanente')).toBe('Diputación Permanente');
    expect(motivoExclusion('pregunta_oral')).toBe('Cuenta como pregunta oral');
    expect(motivoExclusion(undefined)).toBe('');
    expect(sentidoVoto('abstencion')).toBe('Abstención');
    expect(sentidoVoto('raro')).toBe('raro');
  });
});

describe('parseGitLog', () => {
  it('reads hash, date and subject of each data commit and drops malformed lines', async () => {
    const { parseGitLog } = await import('../web/src/lib/git.ts');
    const sha = 'a'.repeat(40);
    expect(parseGitLog(`${sha}\t2026-11-24\tDaily data update 2026-11-24\twith a tab\nnot a commit\n`)).toEqual([
      { sha, fecha: '2026-11-24', asunto: 'Daily data update 2026-11-24\twith a tab' },
    ]);
    expect(parseGitLog('')).toEqual([]);
  });
});

describe('nombreCircunscripcion', () => {
  it('puts the article of an inverted official name in front', () => {
    expect(nombreCircunscripcion('Palmas (Las)')).toBe('Las Palmas');
    expect(nombreCircunscripcion('Coruña (A)')).toBe('A Coruña');
    expect(nombreCircunscripcion('Balears (Illes)')).toBe('Illes Balears');
    expect(nombreCircunscripcion('Rioja (La)')).toBe('La Rioja');
    expect(nombreCircunscripcion("Hospitalet (L')")).toBe("L'Hospitalet");
  });

  it('leaves any other name as it is', () => {
    for (const nombre of [
      'Madrid',
      'Valencia/València',
      'Araba/Álava',
      'Santa Cruz de Tenerife',
      'Algo (con varias palabras dentro)',
    ]) {
      expect(nombreCircunscripcion(nombre)).toBe(nombre);
    }
  });
});
