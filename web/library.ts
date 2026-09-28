import { autoField, battleForme, defaultAbility } from '../src/lib/dex';
import type { MetaSet } from '../src/lib/types';
import type { CustomOpponent } from './calc/types';
import { buildMySet, type EditableSet } from './me';

export type LibraryEntry = { id: string; set: EditableSet; active: boolean };

export const newId = () => Math.random().toString(36).slice(2, 10);

export function toMetaSet(set: EditableSet): MetaSet {
  const my = buildMySet(set);
  const field = autoField(my.ability);
  return {
    weight: 1,
    confidence: 'custom',
    samples: { archetype: 0, spread: 0 },
    spreadMix: { tournament: 0, ladder: 0 },
    forme: my.forme,
    item: set.item,
    ability: my.ability,
    nature: set.nature,
    sp: set.sp,
    moves: my.moves,
    ...(field ? { autoField: field } : {}),
  };
}

export function activeOpponents(library: LibraryEntry[]): CustomOpponent[] {
  return library.filter((e) => e.active).map((e) => ({ id: e.id, species: e.set.species, set: toMetaSet(e.set) }));
}

export function fromMeta(species: string, set: MetaSet): EditableSet {
  const mega = battleForme(species, set.item) !== species;
  return { species, item: set.item, ability: mega ? defaultAbility(species) : set.ability, nature: set.nature, sp: { ...set.sp }, moves: [...set.moves] };
}
