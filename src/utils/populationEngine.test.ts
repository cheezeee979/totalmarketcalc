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

  it('high_childcare_time trait probability is plausible (1%-40%)', () => {
    const selection: SelectionState = {
      ...blankSelection,
      modeledTraits: new Set(['high_childcare_time']),
    }
    const result = estimatePopulation({ selection, modeled, population })
    
    // High childcare time should be a subset of parents with young children
    expect(result.probability).toBeGreaterThan(0.01)
    expect(result.probability).toBeLessThan(0.40)
  })

  it('selecting 0_17 age band produces non-zero estimate', () => {
    const selection: SelectionState = {
      ...blankSelection,
      ageBand: new Set(['0_17']),
    }
    const result = estimatePopulation({ selection, modeled, population })
    
    // Under-18 population should be significant (>50 million)
    expect(result.estimated).toBeGreaterThan(50_000_000)
  })
})
