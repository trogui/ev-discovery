import type { Settings, SideToggles } from './calc/types';

export const NO_BOOSTS = { atk: 0, def: 0, spa: 0, spd: 0 };

export const EMPTY_SIDE: SideToggles = {
  helpingHand: false,
  battery: false,
  powerSpot: false,
  steelySpirit: false,
  charge: false,
  flowerGift: false,
  reflect: false,
  lightScreen: false,
  auroraVeil: false,
  friendGuard: false,
  boosts: NO_BOOSTS,
};

export const DEFAULT_SETTINGS: Settings = {
  band: [85, 115],
  top: 40,
  autoIntimidate: true,
  gravity: false,
  crit: false,
  weather: 'auto',
  terrain: 'auto',
  mine: EMPTY_SIDE,
  theirs: EMPTY_SIDE,
};

const side = (value: Partial<SideToggles> | undefined): SideToggles => ({ ...EMPTY_SIDE, ...value, boosts: { ...NO_BOOSTS, ...value?.boosts } });

export function normalizeSettings(value: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...value, mine: side(value.mine), theirs: side(value.theirs) };
}
