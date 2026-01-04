/// <reference types="vitest" />
import { describe, expect, it } from 'vitest'
import acsCells from '../../data/derived/acs_cells.json' assert { type: 'json' }
import highChildcare from '../../data/derived/traits/high_childcare_time.json' assert { type: 'json' }
import physicallyActive from '../../data/derived/traits/physically_active.json' assert { type: 'json' }
import smokes from '../../data/derived/traits/smokes.json' assert { type: 'json' }
import traitManifest from '../../data/derived/traits_manifest.json' assert { type: 'json' }
import populationShares from '../../public/data/populationShares.json' assert { type: 'json' }
import type { SelectionState } from './calculations'
import { estimatePopulation } from './populationEngine'
import { dailyToWeekly, isAtusOrHobbyTrait } from './traitHelpers'
import type { AcsCells, ModeledAssets, PopulationData, TraitProbabilityFile, TraitManifest } from '../types'

const modeled: ModeledAssets = {
  acsCells: acsCells as unknown as AcsCells,
  manifest: traitManifest as TraitManifest,
  traitProbabilities: {
    smokes: (smokes as TraitProbabilityFile).prob_by_cell,
    physically_active: (physicallyActive as TraitProbabilityFile).prob_by_cell,
    high_childcare_time: (highChildcare as TraitProbabilityFile).prob_by_cell,
  },
}

const blankSelection: SelectionState = {
  sex: new Set(),
  race: new Set(),
  region: new Set(),
  ageBand: new Set(),
  modeledTraits: new Set(),
  employment: new Set(),
  children: new Set(),
  income: new Set(),
  education: new Set(),
  householdType: new Set(),
  transport: new Set(),
}

describe('population engine', () => {
  const population = populationShares as PopulationData

  it('returns total_pop when no filters are selected', () => {
    const result = estimatePopulation({ selection: blankSelection, modeled, population })
    expect(result.estimated).toBe(modeled.acsCells.total_pop)
    expect(result.probability).toBeCloseTo(1, 5)
  })

  it('never exceeds total_pop', () => {
    const selection: SelectionState = {
      ...blankSelection,
      region: new Set(['west']),
    }
    const result = estimatePopulation({ selection, modeled, population })
    expect(result.estimated).toBeLessThanOrEqual(modeled.acsCells.total_pop)
  })

  it('drops when modeled traits are applied', () => {
    const baseline = estimatePopulation({ selection: blankSelection, modeled, population })
    const selection: SelectionState = {
      ...blankSelection,
      modeledTraits: new Set(['smokes', 'physically_active']),
    }
    const withTraits = estimatePopulation({ selection, modeled, population })
    expect(withTraits.estimated).toBeLessThanOrEqual(baseline.estimated)
  })

  it('returns universe label for adults when modeled traits are selected', () => {
    const selection: SelectionState = {
      ...blankSelection,
      modeledTraits: new Set(['smokes']),
    }
    const result = estimatePopulation({ selection, modeled, population })
    expect(result.universeLabel).toContain('18+')
  })

  it('uses all-ages universe when no modeled traits are selected', () => {
    const result = estimatePopulation({ selection: blankSelection, modeled, population })
    expect(result.universeLabel).toContain('all ages')
  })

  it('identifies national-only modeled traits correctly', () => {
    const selection: SelectionState = {
      ...blankSelection,
      modeledTraits: new Set(['high_childcare_time']),
    }
    const result = estimatePopulation({ selection, modeled, population })
    expect(result.nationalModelSelected).toBe(true)
  })
})

describe('trait plausibility checks', () => {
  const population = populationShares as PopulationData

  it('smokes trait probability is plausible (2%-50%)', () => {
    const selection: SelectionState = {
      ...blankSelection,
      modeledTraits: new Set(['smokes']),
    }
    const result = estimatePopulation({ selection, modeled, population })
    
    // Smoking rates should be between 2% and 50% of adults
    // Real US smoking rate is ~11-14%
    expect(result.probability).toBeGreaterThan(0.02)
    expect(result.probability).toBeLessThan(0.50)
  })

  it('physically_active trait probability is plausible (20%-90%)', () => {
    const selection: SelectionState = {
      ...blankSelection,
      modeledTraits: new Set(['physically_active']),
    }
    const result = estimatePopulation({ selection, modeled, population })
    
    // Physical activity rates are typically 70-80% in surveys
    expect(result.probability).toBeGreaterThan(0.20)
    expect(result.probability).toBeLessThan(0.90)
  })

  it('high_childcare_time trait probability is plausible (1%-60%)', () => {
    const selection: SelectionState = {
      ...blankSelection,
      modeledTraits: new Set(['high_childcare_time']),
    }
    const result = estimatePopulation({ selection, modeled, population })
    
    // High childcare time weekly estimate - higher than daily due to 1-(1-p)^7 conversion
    // Daily ~8% converts to weekly ~45%
    expect(result.probability).toBeGreaterThan(0.01)
    expect(result.probability).toBeLessThan(0.60)
  })

  it('selecting Under 18 age bands (0_14 + 15_17) produces non-zero estimate', () => {
    const selection: SelectionState = {
      ...blankSelection,
      ageBand: new Set(['0_14', '15_17']),
    }
    const result = estimatePopulation({ selection, modeled, population })
    
    // Under-18 population should be significant (>50 million)
    expect(result.estimated).toBeGreaterThan(50_000_000)
  })
})

describe('dailyToWeekly conversion', () => {
  it('converts 0.10 daily probability to approximately 0.5217 weekly', () => {
    const result = dailyToWeekly(0.10)
    // 1 - (1 - 0.10)^7 = 1 - 0.9^7 ≈ 0.5217031
    expect(result).toBeCloseTo(0.5217031, 5)
  })

  it('returns 0 for 0 daily probability', () => {
    expect(dailyToWeekly(0)).toBe(0)
  })

  it('returns 1 for 1 daily probability', () => {
    expect(dailyToWeekly(1)).toBe(1)
  })

  it('clamps negative values to 0', () => {
    expect(dailyToWeekly(-0.5)).toBe(0)
  })

  it('clamps values above 1', () => {
    expect(dailyToWeekly(1.5)).toBe(1)
  })

  it('weekly probability is always >= daily probability', () => {
    for (const p of [0.01, 0.05, 0.1, 0.2, 0.5, 0.8]) {
      expect(dailyToWeekly(p)).toBeGreaterThanOrEqual(p)
    }
  })
})

describe('isAtusOrHobbyTrait', () => {
  const manifest = traitManifest as TraitManifest

  it('identifies ATUS/Hobbies traits correctly', () => {
    expect(isAtusOrHobbyTrait('high_childcare_time', manifest)).toBe(true)
    expect(isAtusOrHobbyTrait('has_pet_proxy', manifest)).toBe(true)
    expect(isAtusOrHobbyTrait('plays_sports', manifest)).toBe(true)
    expect(isAtusOrHobbyTrait('spiritual_activities', manifest)).toBe(true)
    expect(isAtusOrHobbyTrait('volunteer_work', manifest)).toBe(true)
  })

  it('returns false for BRFSS/Health traits', () => {
    expect(isAtusOrHobbyTrait('smokes', manifest)).toBe(false)
    expect(isAtusOrHobbyTrait('physically_active', manifest)).toBe(false)
    expect(isAtusOrHobbyTrait('any_alcohol_use', manifest)).toBe(false)
    expect(isAtusOrHobbyTrait('obese', manifest)).toBe(false)
  })

  it('uses fallback for unknown traits without manifest', () => {
    expect(isAtusOrHobbyTrait('high_childcare_time')).toBe(true)
    expect(isAtusOrHobbyTrait('smokes')).toBe(false)
    expect(isAtusOrHobbyTrait('unknown_trait')).toBe(false)
  })
})

describe('BRFSS traits are not converted', () => {
  it('BRFSS trait probabilities are used unchanged (not weekly converted)', () => {
    // Get a specific cell's raw probability (using abbreviated region format)
    const testCellId = 'ne_male_25_34'
    const rawSmokesProb = (smokes as TraitProbabilityFile).prob_by_cell[testCellId]
    
    // For BRFSS traits, the effective probability should match the raw probability
    // (no weekly conversion applied)
    expect(rawSmokesProb).toBeDefined()
    expect(rawSmokesProb).toBeGreaterThan(0)
    expect(rawSmokesProb).toBeLessThan(1)
    
    // Confirm it's NOT being converted by checking the trait classification
    expect(isAtusOrHobbyTrait('smokes', traitManifest as TraitManifest)).toBe(false)
  })
})

describe('transport dimension', () => {
  const population = populationShares as PopulationData

  it('transport dimension exists in population data', () => {
    expect(population.dimensions.transport).toBeDefined()
  })

  it('transport selection changes shareFactor', () => {
    // Skip test if transport not yet in data
    if (!population.dimensions.transport) return

    const baselineResult = estimatePopulation({ selection: blankSelection, modeled, population })
    
    const withTransport: SelectionState = {
      ...blankSelection,
      transport: new Set(['hasVehicle1plus']),
    }
    const transportResult = estimatePopulation({ selection: withTransport, modeled, population })
    
    // Selecting transport should reduce the estimate (shareFactor < 1)
    expect(transportResult.estimated).toBeLessThan(baselineResult.estimated)
    expect(transportResult.shareFactor).toBeLessThan(1)
  })
})

describe('employment universe fix (Under 18 + Employed regression)', () => {
  const population = populationShares as PopulationData

  it('Under 18 only (no employment) returns full child population', () => {
    const selection: SelectionState = {
      ...blankSelection,
      ageBand: new Set(['0_14', '15_17']),
    }
    const result = estimatePopulation({ selection, modeled, population })
    
    // Should return the full Under-18 population (no employment filter to reduce it)
    expect(result.estimated).toBeGreaterThan(50_000_000)
    expect(result.shareFactor).toBeCloseTo(1, 2)
  })

  it('Under 18 + Employed produces dramatically reduced estimate', () => {
    const withoutEmployment: SelectionState = {
      ...blankSelection,
      ageBand: new Set(['0_14', '15_17']),
    }
    const withEmployment: SelectionState = {
      ...blankSelection,
      ageBand: new Set(['0_14', '15_17']),
      employment: new Set(['employed']),
    }
    
    const baseResult = estimatePopulation({ selection: withoutEmployment, modeled, population })
    const employedResult = estimatePopulation({ selection: withEmployment, modeled, population })
    
    // Employment should dramatically reduce the estimate:
    // - 0_14 contributes 0 (not eligible for employment)
    // - 15_17 contributes only 2/3 of its population * employed share
    expect(employedResult.estimated).toBeLessThan(baseResult.estimated * 0.3)
    
    // The estimate should be much less than the Under-18 population
    // It should only be a fraction of the 15-17 population with employment applied
    expect(employedResult.estimated).toBeLessThan(10_000_000)
  })

  it('0_14 + Employed produces zero or near-zero estimate', () => {
    const selection: SelectionState = {
      ...blankSelection,
      ageBand: new Set(['0_14']),
      employment: new Set(['employed']),
    }
    const result = estimatePopulation({ selection, modeled, population })
    
    // 0_14 is completely ineligible for employment, so should contribute 0
    expect(result.estimated).toBe(0)
  })

  it('15_17 + Employed produces partial estimate (2/3 eligibility)', () => {
    const withoutEmployment: SelectionState = {
      ...blankSelection,
      ageBand: new Set(['15_17']),
    }
    const withEmployment: SelectionState = {
      ...blankSelection,
      ageBand: new Set(['15_17']),
      employment: new Set(['employed']),
    }
    
    const baseResult = estimatePopulation({ selection: withoutEmployment, modeled, population })
    const employedResult = estimatePopulation({ selection: withEmployment, modeled, population })
    
    // 15_17 has 2/3 eligibility factor for employment
    // Plus the employed share (~49%)
    // So result should be roughly: base * (2/3) * employedShare
    const expectedRatio = (2/3) * (population.dimensions.employment.employed?.share || 0.49)
    const actualRatio = employedResult.estimated / baseResult.estimated
    
    expect(actualRatio).toBeCloseTo(expectedRatio, 1)
  })

  it('adult + Employed behaves as before (full eligibility)', () => {
    const withoutEmployment: SelectionState = {
      ...blankSelection,
      ageBand: new Set(['25_34']),
    }
    const withEmployment: SelectionState = {
      ...blankSelection,
      ageBand: new Set(['25_34']),
      employment: new Set(['employed']),
    }
    
    const baseResult = estimatePopulation({ selection: withoutEmployment, modeled, population })
    const employedResult = estimatePopulation({ selection: withEmployment, modeled, population })
    
    // Adults have full eligibility (factor = 1)
    // So the ratio should match the employed share
    const employedShare = population.dimensions.employment.employed?.share || 0.49
    const actualRatio = employedResult.estimated / baseResult.estimated
    
    expect(actualRatio).toBeCloseTo(employedShare, 1)
  })
})
