import { describe, expect, it } from 'vitest';

import { nameAliases } from '../config/overrides.ts';
import {
  createNameResolver,
  foldName,
  isCompatibleName,
  nameParts,
  splitSpeaker,
} from '../pipeline/normalize/names.ts';

describe('foldName', () => {
  it('removes accents, case and punctuation and spells out Mª', () => {
    expect(foldName('Moreno Fernández, Mª Isabel')).toBe('moreno fernandez maria isabel');
    expect(foldName('Álvarez de Toledo Peralta-Ramos')).toBe('alvarez de toledo peralta ramos');
  });
});

describe('nameParts', () => {
  it('drops surname connectors written inconsistently', () => {
    expect(nameParts('Ogou i Corbi, Viviane')).toEqual(nameParts('Ogou Corbi, Viviane'));
  });
});

describe('isCompatibleName (suggestions only)', () => {
  it.each([
    ['Alegría Continente, Pilar', 'Alegría Continente, María Pilar'],
    ['Moreno Fernández, María Isabel', 'Moreno Fernández, Mª Isabel'],
    ['Ogou Corbi, Viviane', 'Ogou i Corbi, Viviane'],
    ['Lago Peñas, José Manuel', 'Lago Peñas, Manuel'],
    ['Cuesta Rodríguez, María del Socorro', 'Cuesta Rodríguez, María'],
  ])('%s ~ %s', (a, b) => {
    expect(isCompatibleName(a, b)).toBe(true);
  });

  it.each([
    // Same surnames, different people (a senator and a deputy; a witness and a minister).
    ['Moreno Fernández, Cristina', 'Moreno Fernández, Mª Isabel'],
    ['Rodríguez García, José Francisco', 'Rodríguez García, Isabel'],
    ['Sánchez Pérez, Concepción', 'Sánchez Pérez-Castejón, Pedro'],
  ])('%s is not %s', (a, b) => {
    expect(isCompatibleName(a, b)).toBe(false);
  });
});

describe('splitSpeaker', () => {
  it('separates the group code, including nested parentheses', () => {
    expect(splitSpeaker('Agirretxea Urresti, Joseba Andoni (GV (EAJ-PNV))')).toEqual({
      name: 'Agirretxea Urresti, Joseba Andoni',
      group: 'GV (EAJ-PNV)',
    });
    expect(splitSpeaker('Pueyo Sanz, Jorge (GSUMAR)')).toEqual({ name: 'Pueyo Sanz, Jorge', group: 'GSUMAR' });
  });

  it('keeps names without a suffix', () => {
    expect(splitSpeaker('Rodríguez de Millán Parro, María José')).toEqual({
      name: 'Rodríguez de Millán Parro, María José',
      group: undefined,
    });
  });
});

describe('createNameResolver', () => {
  const census = ['Lago Peñas, Manuel', 'Ogou i Corbi, Viviane'];
  const resolve = createNameResolver(census, [{ variant: 'Lago Peñas, José Manuel', canonical: 'Lago Peñas, Manuel' }]);

  it('matches exact census names and listed aliases only', () => {
    expect(resolve('Lago Peñas, Manuel')).toBe('Lago Peñas, Manuel');
    expect(resolve('Lago Peñas, José Manuel')).toBe('Lago Peñas, Manuel');
    expect(resolve('Ogou Corbi, Viviane')).toBeUndefined();
  });

  it('rejects an alias whose target is not in the census', () => {
    expect(() => createNameResolver(census, [{ variant: 'X, Y', canonical: 'No Existe, Z' }])).toThrow(
      /not in the census/,
    );
  });
});

describe('config/overrides.ts nameAliases', () => {
  it('only lists name-compatible pairs or ones with a written justification', () => {
    for (const alias of nameAliases) {
      expect(alias.variant).not.toBe(alias.canonical);
      if (!isCompatibleName(alias.variant, alias.canonical)) {
        expect(alias.reason.length).toBeGreaterThan(40);
      }
      expect(alias.evidence.length).toBeGreaterThan(20);
      expect(alias.added).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('has no duplicated variants', () => {
    const variants = nameAliases.map((alias) => alias.variant);
    expect(new Set(variants).size).toBe(variants.length);
  });
});
