import type { AcsCell, AgeBandKey, TraitManifest, TraitManifestEntry } from '../types'

/**
 * Maps age band keys to their minimum age
 */
const AGE_BAND_MIN_AGES: Record<AgeBandKey, number> = {
  '0_14': 0,
  '15_17': 15,
  '18_24': 18,
  '25_34': 25,
  '35_44': 35,
  '45_54': 45,
  '55_64': 55,
  '65_plus': 65,
}

/**
 * Employment eligibility factor by age band.
 * Employment data is defined for population 16+.
 * 
 * - 0_14: completely ineligible (factor = 0)
 * - 15_17: partially eligible (ACS has 15-17, but employment is 16+)
 *          MVP approximation: 2/3 eligible (16-17 of 15-17)
 * - 18+: fully eligible (factor = 1)
 */
export const EMPLOYMENT_ELIGIBILITY_FACTOR: Record<AgeBandKey, number> = {
  '0_14': 0,
  '15_17': 2 / 3, // Approximate: 16-17 are eligible, 15 is not
  '18_24': 1,
  '25_34': 1,
  '35_44': 1,
  '45_54': 1,
  '55_64': 1,
  '65_plus': 1,
}

/**
 * Get the employment eligibility factor for an age band.
 * Returns 0 for ages ineligible for employment, 1 for fully eligible,
 * and 2/3 for the 15-17 band (MVP approximation).
 */
export const getEmploymentEligibilityFactor = (ageBand: AgeBandKey): number => {
  return EMPLOYMENT_ELIGIBILITY_FACTOR[ageBand] ?? 1
}

/**
 * Check if an age band is at least partially eligible for employment filters.
 */
export const isEmploymentEligible = (ageBand: AgeBandKey): boolean => {
  return EMPLOYMENT_ELIGIBILITY_FACTOR[ageBand] > 0
}

/**
 * Convert a daily probability to "at least once per week" probability.
 * Formula: p_week = 1 - (1 - p_day)^7
 *
 * This assumes each day is an independent trial with equal probability.
 * Used for ATUS time-use diary data to convert one-day observations to weekly estimates.
 */
export const dailyToWeekly = (pDay: number): number => {
  const clamped = Math.min(Math.max(pDay, 0), 1)
  const pWeek = 1 - Math.pow(1 - clamped, 7)
  return Math.min(Math.max(pWeek, 0), 1)
}

/**
 * Hardcoded list of ATUS/Hobbies trait keys as a fallback.
 * These traits come from one-day time diaries and need weekly conversion.
 */
const ATUS_HOBBY_TRAIT_KEYS = new Set([
  'high_childcare_time',
  'has_pet_proxy',
  'plays_sports',
  'spiritual_activities',
  'volunteer_work',
])

/**
 * Check if a trait is an ATUS/Hobbies trait that needs daily-to-weekly conversion.
 *
 * Uses manifest metadata when available (group === 'Hobbies' or source includes 'ATUS'),
 * falls back to hardcoded set otherwise.
 */
export const isAtusOrHobbyTrait = (traitKey: string, manifest?: TraitManifest): boolean => {
  if (manifest) {
    const trait = manifest.traits.find((t) => t.key === traitKey)
    if (trait) {
      // Check if it's a Hobbies group or if source mentions ATUS
      return trait.group === 'Hobbies' || trait.source.toUpperCase().includes('ATUS')
    }
  }
  // Fallback to hardcoded list
  return ATUS_HOBBY_TRAIT_KEYS.has(traitKey)
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

