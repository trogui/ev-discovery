import type { Pokemon } from '@smogon/calc';

export type Recovery = { sitrus: boolean; pinch: boolean; endOfTurn: number; sash: boolean; notes: string[] };

const PINCH_BERRIES = new Set(['Figy Berry', 'Wiki Berry', 'Mago Berry', 'Aguav Berry', 'Iapapa Berry']);
const SAND_IMMUNE_ABILITIES = new Set(['Overcoat', 'Sand Veil', 'Sand Rush', 'Sand Force', 'Magic Guard']);

export function recoveryFor(defender: Pokemon, field: { weather: string; terrain: string; gravity: boolean }): Recovery {
  const hp = defender.maxHP();
  const item = defender.item ?? '';
  const ability = defender.ability ?? '';
  const types = defender.types as string[];
  const notes: string[] = [];
  let endOfTurn = 0;

  const sitrus = item === 'Sitrus Berry';
  if (sitrus) notes.push('Sitrus');
  const pinch = PINCH_BERRIES.has(item);
  if (pinch) notes.push(item);
  if (item === 'Leftovers' || (item === 'Black Sludge' && types.includes('Poison'))) {
    endOfTurn += Math.floor(hp / 16);
    notes.push(item);
  }
  const grounded = field.gravity || (!types.includes('Flying') && ability !== 'Levitate' && item !== 'Air Balloon');
  if (field.terrain === 'Grassy' && grounded) {
    endOfTurn += Math.floor(hp / 16);
    notes.push('Grassy heal');
  }
  if (
    field.weather === 'Sand' &&
    !types.some((t) => t === 'Rock' || t === 'Ground' || t === 'Steel') &&
    !SAND_IMMUNE_ABILITIES.has(ability) &&
    item !== 'Safety Goggles'
  ) {
    endOfTurn -= Math.floor(hp / 16);
    notes.push('Sand chip');
  }
  return { sitrus, pinch, endOfTurn, sash: item === 'Focus Sash' || ability === 'Sturdy', notes };
}

function knockedOutInTwo(hp: number, first: number, second: number, r: Recovery, multiHit: boolean) {
  let current = hp - first;
  if (current <= 0) {
    if (!(r.sash && !multiHit)) return true;
    current = 1;
  }
  if (r.sitrus && current <= hp / 2) current += Math.floor(hp / 4);
  else if (r.pinch && current <= hp / 4) current += Math.floor(hp / 3);
  current = Math.min(hp, current + r.endOfTurn);
  if (current <= 0) return true;
  return current - second <= 0;
}

export function twoHitKoChance(first: Map<number, number>, second: Map<number, number>, hp: number, r: Recovery, multiHit: boolean) {
  let chance = 0;
  for (const [a, pa] of first) for (const [b, pb] of second) if (knockedOutInTwo(hp, a, b, r, multiHit)) chance += pa * pb;
  return chance;
}

const lineCache = new Map<string, number>();

export function twoHitLine(hp: number, r: Recovery, ratio = 1) {
  const key = `${hp}|${r.sitrus}|${r.pinch}|${r.endOfTurn}|${r.sash}|${ratio}`;
  const cached = lineCache.get(key);
  if (cached !== undefined) return cached;
  let line = hp;
  for (let x = 1; x <= hp; x++) {
    if (knockedOutInTwo(hp, x, Math.floor(x * ratio), r, false)) {
      line = x;
      break;
    }
  }
  lineCache.set(key, line);
  return line;
}
