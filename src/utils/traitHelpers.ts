import type { AcsCell, AgeBandKey, TraitManifestEntry } from '../types'

/**
 * Maps age band keys to their minimum age
 */
const AGE_BAND_MIN_AGES: Record<AgeBandKey, number> = {
  '0_17': 0,
  '18_24': 18,
  '25_34': 25,
  '35_44': 35,
  '45_54': 45,
  '55_64': 55,
  '65_plus': 65,
}

/**
 * Checks if an age band is eligible for a trait based on minAge
 */
export const isAgeBandEligible = (band: AgeBandKey, minAge: number): boolean => {
  const bandMinAge = AGE_BAND_MIN_AGES[band]
  // The age band is eligible if its minimum age >= trait's minAge
  // For 0_17, min is 0, so it's NOT eligible for any trait with minAge >= 18
  return bandMinAge >= minAge
}

/**
 * Get all eligible age bands for a given minAge
 */
export const getEligibleAgeBands = (minAge: number): AgeBandKey[] => {
  return (Object.keys(AGE_BAND_MIN_AGES) as AgeBandKey[]).filter(
    (band) => isAgeBandEligible(band, minAge)
  )
}

/**
 * Compute the effective minimum age from a set of selected traits
 */
export const computeEffectiveMinAge = (traits: TraitManifestEntry[]): number => {
  if (traits.length === 0) return 0
  return Math.max(...traits.map((t) => t.minAge))
}

/**
 * Compute denominator population based on effective minAge
 */
export const computeDenominatorPop = (cells: AcsCell[], minAge: number): number => {
  return cells
    .filter((cell) => isAgeBandEligible(cell.age_band, minAge))
    .reduce((sum, cell) => sum + cell.pop, 0)
}

/**
 * Get universe label based on effective minAge
 */
export const getUniverseLabel = (minAge: number): string => {
  if (minAge === 0) return 'U.S. population (all ages)'
  if (minAge === 18) return 'U.S. adults (18+)'
  if (minAge === 15) return 'U.S. population (15+)'
  return `U.S. population (${minAge}+)`
}

/**
 * Check if any selected age bands are below the trait's minAge
 */
export const hasIneligibleAgeBands = (
  selectedAgeBands: Set<AgeBandKey>,
  minAge: number
): boolean => {
  if (selectedAgeBands.size === 0) return false
  return Array.from(selectedAgeBands).some((band) => !isAgeBandEligible(band, minAge))
}

/**
 * Filter cells to only include those eligible for the given minAge
 */
export const filterEligibleCells = (cells: AcsCell[], minAge: number): AcsCell[] => {
  return cells.filter((cell) => isAgeBandEligible(cell.age_band, minAge))
}

