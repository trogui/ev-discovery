import { Field, Move, Pokemon, Side, calculate } from '@smogon/calc';
import { autoField, gen } from '../../src/lib/dex';
import type { Meta, MetaSet } from '../../src/lib/types';
import type { CalcRow, MySet, PokemonResult, Settings, SideToggles, Terrain, Weather } from './types';

const INTIMIDATE_IMMUNE = new Set(['Clear Body', 'White Smoke', 'Full Metal Body', 'Hyper Cutter', 'Inner Focus', 'Oblivious', 'Own Tempo', 'Scrappy', 'Guard Dog', 'Mirror Armor']);

type Combatant = { forme: string; item: string | null; ability: string | null; nature: string; sp: MySet['sp'] };

function toSide(t: SideToggles) {
  return new Side({ isReflect: t.reflect, isLightScreen: t.lightScreen, isHelpingHand: t.helpingHand, isFriendGuard: t.friendGuard });
}

function hitsOf(damage: unknown): number[][] {
  if (typeof damage === 'number') return [[damage]];
  const arr = damage as unknown[];
  if (Array.isArray(arr[0])) return arr as number[][];
  return [arr as number[]];
}

function totalDistribution(hits: number[][]) {
  let dist = new Map<number, number>([[0, 1]]);
  for (const rolls of hits) {
    const next = new Map<number, number>();
    for (const [sum, p] of dist) for (const roll of rolls) next.set(sum + roll, (next.get(sum + roll) ?? 0) + p / rolls.length);
    dist = next;
  }
  return dist;
}

function resolveField(settings: Settings, me: MySet, opp: MetaSet) {
  const mine = autoField(me.ability);
  const theirs = opp.autoField;
  const weather: Weather = settings.weather === 'auto' ? ((theirs?.weather ?? mine?.weather ?? '') as Weather) : settings.weather;
  const terrain: Terrain = settings.terrain === 'auto' ? ((theirs?.terrain ?? mine?.terrain ?? '') as Terrain) : settings.terrain;
  return { weather, terrain, intimidateByMe: settings.autoIntimidate && !!mine?.intimidate, intimidateByThem: settings.autoIntimidate && !!theirs?.intimidate };
}

function intimidated(target: Combatant) {
  return !INTIMIDATE_IMMUNE.has(target.ability ?? '') && target.item !== 'Clear Amulet';
}

function makePokemon(c: Combatant, atkBoost: number) {
  return new Pokemon(gen, c.forme, {
    nature: c.nature,
    evs: c.sp,
    item: c.item ?? undefined,
    ability: c.ability ?? undefined,
    boosts: atkBoost ? { atk: atkBoost } : undefined,
  });
}

function runCalc(attacker: Combatant, defender: Combatant, moveName: string, field: Field, atkBoost: number) {
  const atk = makePokemon(attacker, atkBoost);
  const def = makePokemon(defender, 0);
  const move = new Move(gen, moveName);
  const result = calculate(gen, atk, def, move, field);
  const hits = hitsOf(result.damage);
  const dist = totalDistribution(hits);
  const totals = [...dist.keys()];
  const minDamage = Math.min(...totals);
  const maxDamage = Math.max(...totals);
  if (maxDamage <= 0) return null;
  const hp = def.maxHP();
  let koChance = 0;
  for (const [sum, p] of dist) if (sum >= hp) koChance += p;
  let note: string | undefined;
  if (hits.length === 1 && koChance > 0) {
    if (defender.item === 'Focus Sash') note = 'Focus Sash';
    else if (defender.ability === 'Sturdy') note = 'Sturdy';
    if (note) koChance = 0;
  }
  let desc = '';
  try {
    desc = result.desc();
  } catch {
    desc = `${attacker.forme} ${moveName} vs. ${defender.forme}`;
  }
  return { minDamage, maxDamage, hp, koChance, desc, note, moveType: move.type, rolls: hits.map((h) => h.join(',')).join('|') };
}

function fieldTags(f: ReturnType<typeof resolveField>, s: Settings, direction: 'in' | 'out', physicalIntimidate: boolean) {
  const tags: string[] = [];
  if (f.weather) tags.push(f.weather);
  if (f.terrain) tags.push(`${f.terrain} Terrain`);
  if (physicalIntimidate) tags.push('Intimidate');
  const attacker = direction === 'in' ? s.theirs : s.mine;
  const defender = direction === 'in' ? s.mine : s.theirs;
  if (attacker.helpingHand) tags.push('Helping Hand');
  if (defender.reflect) tags.push('Reflect');
  if (defender.lightScreen) tags.push('Light Screen');
  if (defender.friendGuard) tags.push('Friend Guard');
  return tags;
}

export function computeAll(meta: Meta, me: MySet, settings: Settings) {
  const [lo, hi] = settings.band;
  let totalCalcs = 0;
  const results: PokemonResult[] = [];

  for (const mon of meta.pokemon.slice(0, settings.top)) {
    const rows = new Map<string, CalcRow>();
    for (const set of mon.sets) {
      const f = resolveField(settings, me, set);
      const opp: Combatant = { forme: set.forme, item: set.item, ability: set.ability, nature: set.nature, sp: set.sp };
      const ref = { forme: set.forme, item: set.item, nature: set.nature, sp: set.sp, weight: set.weight, confidence: set.confidence };

      const directions: ('in' | 'out')[] = settings.direction === 'both' ? ['in', 'out'] : [settings.direction];
      for (const direction of directions) {
        const attacker = direction === 'in' ? opp : me;
        const defender = direction === 'in' ? me : opp;
        const moves = direction === 'in' ? set.moves : me.moves;
        const intimidate = direction === 'in' ? f.intimidateByMe : f.intimidateByThem;
        const atkBoost = intimidate && intimidated(attacker) ? -1 : 0;
        const field = new Field({
          gameType: 'Doubles',
          weather: f.weather || undefined,
          terrain: f.terrain || undefined,
          attackerSide: toSide(direction === 'in' ? settings.theirs : settings.mine),
          defenderSide: toSide(direction === 'in' ? settings.mine : settings.theirs),
        });
        for (const moveName of moves) {
          totalCalcs++;
          const r = runCalc(attacker, defender, moveName, field, atkBoost);
          if (!r) continue;
          const minPct = (r.minDamage / r.hp) * 100;
          const maxPct = (r.maxDamage / r.hp) * 100;
          if (maxPct < lo || minPct > hi) continue;
          const physical = gen.moves.get(moveName.toLowerCase().replace(/[^a-z0-9]/g, '') as never)?.category === 'Physical';
          const tags = fieldTags(f, settings, direction, atkBoost !== 0 && physical);
          const key = `${direction}|${moveName}|${r.rolls}|${r.hp}|${tags.join(',')}`;
          const existing = rows.get(key);
          if (existing) {
            existing.weight += set.weight;
            existing.sets.push(ref);
            continue;
          }
          rows.set(key, {
            key: `${mon.species}|${key}`,
            direction,
            move: moveName,
            moveType: r.moveType,
            minPct,
            maxPct,
            minDamage: r.minDamage,
            maxDamage: r.maxDamage,
            hp: r.hp,
            koChance: r.koChance,
            weight: set.weight,
            sets: [ref],
            field: tags,
            desc: r.desc,
            note: r.note,
          });
        }
      }
    }
    if (rows.size) {
      const sorted = [...rows.values()].sort((a, b) => (a.direction === b.direction ? b.weight - a.weight : a.direction === 'in' ? -1 : 1));
      results.push({ species: mon.species, rank: mon.rank, rows: sorted, totalSets: mon.sets.length });
    }
  }
  return { results, totalCalcs };
}

