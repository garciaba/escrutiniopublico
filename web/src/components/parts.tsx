/**
 * Small presentational pieces shared by the ranking table and the profiles. They are
 * SVG on purpose: the site's CSP forbids inline styles, so widths and colours travel
 * as SVG attributes.
 */
import type { ComponentChildren } from 'preact';
import { num } from '../lib/format.ts';

/**
 * A word that explains itself: a tap opens its entry of the glossary (config/glosario.ts),
 * which the page shell renders once as a pop-up. No JavaScript involved.
 */
export function Termino({ id, children }: { id: string; children: ComponentChildren }) {
  return (
    <button type="button" class="termino" popovertarget={`glosa-${id}`}>
      {children}
    </button>
  );
}

/** Thin horizontal meter, 0 to 100. Decorative: the number is always printed next to it. */
export function Medidor({ valor, clase }: { valor: number; clase?: string }) {
  return (
    <svg class={clase ? `medidor ${clase}` : 'medidor'} aria-hidden="true">
      <rect width={`${Math.max(0, Math.min(100, valor))}%`} height="100%" />
    </svg>
  );
}

/** Dot with the colour of a parliamentary group; always next to the group's name. */
export function PuntoGrupo({ color }: { color: string }) {
  return (
    <svg class="punto-grupo" viewBox="0 0 8 8" aria-hidden="true">
      <circle cx="4" cy="4" r="4" fill={color} />
    </svg>
  );
}

/** A score from 0 to 100 with its meter, or an explicit "not available" (never a zero). */
export function Puntuacion({ valor, decimales = 1 }: { valor: number | null | undefined; decimales?: number }) {
  if (valor === null || valor === undefined) {
    return (
      <span class="nd">
        <span aria-hidden="true">—</span>
        <span class="sr">No disponible</span>
      </span>
    );
  }
  return (
    <>
      <span class="valor">{num(valor, decimales)}</span>
      <Medidor valor={valor} />
    </>
  );
}
