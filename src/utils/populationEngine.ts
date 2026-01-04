import type { AcsCell, AgeBandKey, ModeledAssets, ModeledTraitKey, PopulationData } from '../types'
import type { SelectionState } from './calculations'
import { computeDimensionProbability } from './calculations'
import {
  computeDenominatorPop,
  computeEffectiveMinAge,
  dailyToWeekly,
  getEmploymentEligibilityFactor,
  getUniverseLabel,
  isAgeBandEligible,
  isAtusOrHobbyTrait,
} from './traitHelpers'

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value))

const filterCells = (cells: AcsCell[], selection: SelectionState, effectiveMinAge: number) =>
  cells.filter((cell) => {
    // Exclude cells that don't meet the minAge requirement for modeled traits
    if (!isAgeBandEligible(cell.age_band, effectiveMinAge)) return false
    
    const matchesRegion = selection.region.size ? selection.region.has(cell.region) : true
    const matchesSex = selection.sex.size ? selection.sex.has(cell.sex) : true
    // For age bands, only consider eligible ones
    const matchesAge = selection.ageBand.size
      ? selection.ageBand.has(cell.age_band) && isAgeBandEligible(cell.age_band, effectiveMinAge)
      : true
    return matchesRegion && matchesSex && matchesAge
  })

/**
 * Compute the base share factor (excluding employment, which is age-aware).
 * This is applied globally after the cell-level calculation.
 */
const computeBaseShareFactor = (selection: SelectionState, population: PopulationData) => {
  // Employment is handled separately per-cell due to age eligibility
  const entries: Array<[Set<string>, Record<string, { share: number; count: number }>]> = [
    [selection.race, population.dimensions.race],
    [selection.children, population.dimensions.children],
    [selection.income, population.dimensions.income],
    [selection.education, population.dimensions.education],
    [selection.householdType, population.dimensions.householdType],
    [selection.transport, population.dimensions.transport],
  ]

  const product = entries.reduce((acc, [selected, shares]) => {
    const p = computeDimensionProbability(selected, shares)
    return acc * p
  }, 1)

  return clamp(product, 0, 1)
}

/**
 * Compute the employment share factor for a specific cell, considering age eligibility.
 * 
 * Employment is defined for population 16+:
 * - 0_14: completely ineligible → factor = 0
 * - 15_17: partially eligible (15 is not 16+) → factor = 2/3 * employment_share
 * - 18+: fully eligible → factor = employment_share
 * 
 * If no employment filter is selected, returns 1 (no effect).
 */
const computeCellEmploymentFactor = (
  ageBand: AgeBandKey,
  selection: SelectionState,
  population: PopulationData
): number => {
  if (selection.employment.size === 0) {
    return 1 // No employment filter selected
  }

  const eligibilityFactor = getEmploymentEligibilityFactor(ageBand)
  
  if (eligibilityFactor === 0) {
    return 0 // Cell is ineligible for employment (e.g., 0_14)
  }

  // Compute the employment dimension probability
  const employmentProb = computeDimensionProbability(
    selection.employment,
    population.dimensions.employment
  )

  // Apply eligibility factor for partial eligibility (15_17)
  return eligibilityFactor * employmentProb
}

/**
 * Compute the product of trait probabilities for a cell.
 * ATUS/Hobbies traits are converted from daily to weekly probabilities.
 */
const traitProduct = (
  cellId: string,
  traitKeys: ModeledTraitKey[],
  probabilities: ModeledAssets['traitProbabilities'],
  manifest: ModeledAssets['manifest'],
) =>
  traitKeys.reduce((acc, key) => {
    const prob = probabilities[key]?.[cellId]
    if (prob === undefined) {
      throw new Error(`Missing probability for trait ${key} at cell ${cellId}. Run npm run build:modeled-data.`)
    }
    // Convert ATUS/Hobbies traits from daily probability to weekly
    const effectiveProb = isAtusOrHobbyTrait(key, manifest) ? dailyToWeekly(prob) : prob
    return acc * effectiveProb
  }, 1)

export type EstimateResult = {
  estimated: number
  probability: number
  shareFactor: number
  matchingCells: number
  denominatorPop: number
  universeLabel: string
  nationalModelSelected: boolean
  effectiveMinAge: number
}

export const estimatePopulation = (opts: {
  selection: SelectionState
  modeled: ModeledAssets
  population: PopulationData
}): EstimateResult => {
  const { selection, modeled, population } = opts
  const traitKeys = Array.from(selection.modeledTraits)
  
  // Look up trait metadata for selected traits
  const selectedTraits = modeled.manifest.traits.filter((t) => traitKeys.includes(t.key))
  
  // Compute effective minAge from selected traits (0 if no traits selected)
  const effectiveMinAge = computeEffectiveMinAge(selectedTraits)
  
  // Determine if any national-only trait is selected
  const nationalModelSelected = selectedTraits.some((t) => t.regionSupport === 'national_only')
  
  // Get universe label and denominator based on effective minAge
  const universeLabel = getUniverseLabel(effectiveMinAge)
  const denominatorPop = effectiveMinAge === 0
    ? modeled.acsCells.total_pop
    : computeDenominatorPop(modeled.acsCells.cells, effectiveMinAge)
  
  // Filter cells with age eligibility
  const filtered = filterCells(modeled.acsCells.cells, selection, effectiveMinAge)
  
  // Base share factor (excludes employment, which is applied per-cell)
  const baseShareFactor = computeBaseShareFactor(selection, population)

  // Compute weighted sum with per-cell employment factor
  const weightedSum = filtered.reduce((acc, cell) => {
    const modeledMultiplier = traitKeys.length 
      ? traitProduct(cell.cell_id, traitKeys, modeled.traitProbabilities, modeled.manifest) 
      : 1
    
    // Employment is applied per-cell based on age band eligibility
    const employmentFactor = computeCellEmploymentFactor(cell.age_band, selection, population)
    
    // Combined cell contribution: pop * modeled * employment * base_share
    const cellContribution = cell.pop * modeledMultiplier * employmentFactor * baseShareFactor
    
    return acc + cellContribution
  }, 0)

  const estimated = weightedSum
  const probability = denominatorPop ? estimated / denominatorPop : 0
  
  // Compute effective shareFactor for debugging/display
  // This is the ratio of estimated to the base (pre-share) weighted sum
  const baseWeightedSum = filtered.reduce((acc, cell) => {
    const modeledMultiplier = traitKeys.length 
      ? traitProduct(cell.cell_id, traitKeys, modeled.traitProbabilities, modeled.manifest) 
      : 1
    return acc + cell.pop * modeledMultiplier
  }, 0)
  const effectiveShareFactor = baseWeightedSum > 0 ? estimated / baseWeightedSum : 1

  return {
    estimated: Math.round(estimated),
    probability: clamp(probability, 0, 1),
    shareFactor: clamp(effectiveShareFactor, 0, 1),
    matchingCells: filtered.length,
    denominatorPop,
    universeLabel,
    nationalModelSelected,
    effectiveMinAge,
  }
}
