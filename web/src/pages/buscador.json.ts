import type { APIRoute } from 'astro';
import { groups } from '../../../config/parties.ts';
import { loadRanking } from '../lib/data.ts';
import { indiceBuscador } from '../lib/buscador.ts';

/** Index of deputies for the search box of the header; fetched the first time it is used. */
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      indiceBuscador(loadRanking(), Object.fromEntries(groups.map((group) => [group.code, group.shortName]))),
    ),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
