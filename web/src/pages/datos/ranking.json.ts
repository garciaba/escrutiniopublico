import type { APIRoute } from 'astro';
import { derivedText } from '../../lib/data.ts';

/** data/derived/ranking.json, byte for byte. */
export const GET: APIRoute = () =>
  new Response(derivedText('ranking.json'), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
