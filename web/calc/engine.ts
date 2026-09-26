import { Field, Move, Pokemon, Side, calculate } from '@smogon/calc';
import { autoField, gen } from '../../src/lib/dex';
import { recoveryFor, twoHitKoChance, twoHitLine } from './twohko';
import type { Meta, MetaSet } from '../../src/lib/types';
import type { Boosts, CalcRow, CalcSettings, CustomOpponent, MySet, PokemonResult, SideToggles, Terrain, Weather } from './types';

const INTIMIDATE_IMMUNE = new Set(['Clear Body', 'White Smoke', 'Full Metal Body', 'Hyper Cutter', 'Inner Focus', 'Oblivious', 'Own Tempo', 'Scrappy', 'Guard Dog', 'Mirror Armor']);

type Combatant = { forme: string; item: string | null; ability: string | null; nature: string; sp: MySet['sp'] };

function toSide(t: SideToggles) {
  return new Side({
    isHelpingHand: t.helpingHand,
    isBattery: t.battery,
    isPowerSpot: t.powerSpot,
    isSteelySpirit: t.steelySpirit,
    isCharge: t.charge,
    isFlowerGift: t.flowerGift,
    isReflect: t.reflect,
    isLightScreen: t.lightScreen,
    isAuroraVeil: t.auroraVeil,
    isFriendGuard: t.friendGuard,
  });
}

const clampBoost = (n: number) => Math.max(-6, Math.min(6, n));

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

function resolveField(settings: CalcSettings, me: MySet, opp: MetaSet) {
  const mine = autoField(me.ability);
  const theirs = opp.autoField;
  const weather: Weather = settings.weather === 'auto' ? ((theirs?.weather ?? mine?.weather ?? '') as Weather) : settings.weather;
  const terrain: Terrain = settings.terrain === 'auto' ? ((theirs?.terrain ?? mine?.terrain ?? '') as Terrain) : settings.terrain;
  return { weather, terrain, intimidateByMe: settings.autoIntimidate && !!mine?.intimidate, intimidateByThem: settings.autoIntimidate && !!theirs?.intimidate };
}

function intimidated(target: Combatant) {
  return !INTIMIDATE_IMMUNE.has(target.ability ?? '') && target.item !== 'Clear Amulet';
}

function makePokemon(c: Combatant, boosts: Partial<Boosts>) {
  return new Pokemon(gen, c.forme, {
    nature: c.nature,
    evs: c.sp,
    item: c.item ?? undefined,
    ability: c.ability ?? undefined,
    boosts,
  });
}

function runCalc(attacker: Combatant, defender: Combatant, moveName: string, field: Field, attackerBoosts: Boosts, defenderBoosts: Boosts, crit: boolean, env: { weather: string; terrain: string; gravity: boolean }) {
  const atk = makePokemon(attacker, { atk: attackerBoosts.atk, spa: attackerBoosts.spa });
  const def = makePokemon(defender, { def: defenderBoosts.def, spd: defenderBoosts.spd });
  const move = new Move(gen, moveName, { isCrit: crit });
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
  const recovery = recoveryFor(def, env);
  const multiHit = hits.length > 1;
  const ko2Chance = twoHitKoChance(dist, hp, recovery, multiHit);
  const line2 = twoHitLine(hp, recovery);
  let desc = '';
  try {
    desc = result.desc();
  } catch {
    desc = `${attacker.forme} ${moveName} vs. ${defender.forme}`;
  }
  return { minDamage, maxDamage, hp, koChance, ko2Chance, line2Pct: (line2 / hp) * 100, recoveryNotes: recovery.notes, desc, note, moveType: move.type, rolls: hits.map((h) => h.join(',')).join('|') };
}

const ATTACKER_TAGS: [keyof SideToggles, string][] = [
  ['helpingHand', 'Helping Hand'],
  ['battery', 'Battery'],
  ['powerSpot', 'Power Spot'],
  ['steelySpirit', 'Steely Spirit'],
  ['charge', 'Charge'],
];

const DEFENDER_TAGS: [keyof SideToggles, string][] = [
  ['reflect', 'Reflect'],
  ['lightScreen', 'Light Screen'],
  ['auroraVeil', 'Aurora Veil'],
  ['friendGuard', 'Friend Guard'],
  ['flowerGift', 'Flower Gift'],
];

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function fieldTags(f: ReturnType<typeof resolveField>, s: CalcSettings, attacker: SideToggles, defender: SideToggles, attackBoost: number, defenseBoost: number, category: string | undefined) {
  const tags: string[] = [];
  if (f.weather) tags.push(f.weather);
  if (f.terrain) tags.push(`${f.terrain} Terrain`);
  if (s.gravity) tags.push('Gravity');
  if (s.crit) tags.push('Crit');
  const attackStat = category === 'Special' ? 'SpA' : 'Atk';
  const defenseStat = category === 'Special' ? 'SpD' : 'Def';
  if (attackBoost) tags.push(`${signed(attackBoost)} ${attackStat}`);
  if (defenseBoost) tags.push(`${signed(defenseBoost)} ${defenseStat}`);
  for (const [key, label] of ATTACKER_TAGS) if (attacker[key]) tags.push(label);
  for (const [key, label] of DEFENDER_TAGS) if (defender[key]) tags.push(label);
  return tags;
}

export function computeAll(meta: Meta, me: MySet, settings: CalcSettings, extraSpecies: string[] = [], custom: CustomOpponent[] = []) {
  let totalCalcs = 0;
  const results: PokemonResult[] = [];
  const extra = new Set(extraSpecies);
  const opponents = [
    ...custom.map((c) => ({ key: `custom:${c.id}`, custom: true, inTop: false, mon: { species: c.set.forme, rank: 0, sets: [c.set] } })),
    ...meta.pokemon
      .map((mon, i) => ({ key: mon.species, custom: false, inTop: i < settings.top, mon }))
      .filter(({ mon, inTop }) => inTop || extra.has(mon.species)),
  ];

  for (const { key: opponentKey, custom: isCustom, mon, inTop } of opponents) {
    const rows = new Map<string, CalcRow>();
    mon.sets.forEach((set, setIndex) => {
      const f = resolveField(settings, me, set);
      const opp: Combatant = { forme: set.forme, item: set.item, ability: set.ability, nature: set.nature, sp: set.sp };
      const ref = { forme: set.forme, item: set.item, nature: set.nature, sp: set.sp, weight: set.weight, confidence: set.confidence };

      for (const direction of ['in', 'out'] as const) {
        const attacker = direction === 'in' ? opp : me;
        const defender = direction === 'in' ? me : opp;
        const moves = direction === 'in' ? set.moves : me.moves;
        const intimidate = direction === 'in' ? f.intimidateByMe : f.intimidateByThem;
        const attackerSide = direction === 'in' ? settings.theirs : settings.mine;
        const defenderSide = direction === 'in' ? settings.mine : settings.theirs;
        const attackerBoosts = { ...attackerSide.boosts, atk: clampBoost(attackerSide.boosts.atk - (intimidate && intimidated(attacker) ? 1 : 0)) };
        const field = new Field({
          gameType: 'Doubles',
          weather: f.weather || undefined,
          terrain: f.terrain || undefined,
          isGravity: settings.gravity,
          attackerSide: toSide(attackerSide),
          defenderSide: toSide(defenderSide),
        });
        moves.forEach((moveName, moveIndex) => {
          totalCalcs++;
          const r = runCalc(attacker, defender, moveName, field, attackerBoosts, defenderSide.boosts, settings.crit, { weather: f.weather, terrain: f.terrain, gravity: settings.gravity });
          if (!r) return;
          const category = gen.moves.get(moveName.toLowerCase().replace(/[^a-z0-9]/g, '') as never)?.category;
          const special = category === 'Special';
          const tags = fieldTags(
            f,
            settings,
            attackerSide,
            defenderSide,
            special ? attackerBoosts.spa : attackerBoosts.atk,
            special ? defenderSide.boosts.spd : defenderSide.boosts.def,
            category,
          );
          const resultKey = `${direction}|${moveName}|${r.rolls}|${r.hp}|${tags.join(',')}|${r.recoveryNotes.join(',')}`;
          const existing = rows.get(resultKey);
          if (existing) {
            existing.weight += set.weight;
            existing.sets.push(ref);
            return;
          }
          rows.set(resultKey, {
            key: `${opponentKey}|${direction}|${moveName}|${setIndex}`,
            order: setIndex * 100 + moveIndex,
            direction,
            move: moveName,
            moveType: r.moveType,
            minPct: (r.minDamage / r.hp) * 100,
            maxPct: (r.maxDamage / r.hp) * 100,
            minDamage: r.minDamage,
            maxDamage: r.maxDamage,
            hp: r.hp,
            koChance: r.koChance,
            ko2Chance: r.ko2Chance,
            line2Pct: r.line2Pct,
            recoveryNotes: r.recoveryNotes,
            weight: set.weight,
            sets: [ref],
            field: tags,
            desc: r.desc,
            note: r.note,
          });
        });
      }
    });
    results.push({ key: opponentKey, species: mon.species, custom: isCustom, rank: mon.rank, inTop, rows: [...rows.values()].sort((a, b) => a.order - b.order), totalSets: mon.sets.length });
  }
  return { results, totalCalcs };
}
