export type SexKey = 'male' | 'female'
export type RaceKey = 'white' | 'black' | 'asian' | 'other'
export type RegionKey = 'northeast' | 'midwest' | 'south' | 'west'
export type EmploymentKey = 'employed' | 'unemployed' | 'notInLabor'
export type AgeKey = 'age0to17' | 'age18to34' | 'age35to54' | 'age55to74' | 'age75plus'
export type AgeBandKey = '0_17' | '18_24' | '25_34' | '35_44' | '45_54' | '55_64' | '65_plus'
export type ChildrenKey = 'hasChildren' | 'noChildren'
export type IncomeKey = 'under25k' | 'income25to50k' | 'income50to75k' | 'income75to100k' | 'income100to150k' | 'over150k'
export type EducationKey = 'lessThanHighSchool' | 'highSchool' | 'someCollege' | 'bachelors' | 'graduate'
export type HouseholdTypeKey = 'marriedCouple' | 'singleParent' | 'livingAlone' | 'otherHousehold'

export type DimensionName = 'sex' | 'race' | 'region' | 'employment' | 'age' | 'children' | 'income' | 'education' | 'householdType'

export type CategoryStats = {
  count: number
  share: number
}

export type PopulationData = {
  meta: {
    year: number
    source: string
    generatedAt: string
  }
  totalPopulation: number
  dimensions: {
    sex: Record<SexKey, CategoryStats>
    race: Record<RaceKey, CategoryStats>
    region: Record<RegionKey, CategoryStats>
    employment: Record<EmploymentKey, CategoryStats>
    age: Record<AgeKey, CategoryStats>
    children: Record<ChildrenKey, CategoryStats>
    income: Record<IncomeKey, CategoryStats>
    education: Record<EducationKey, CategoryStats>
    householdType: Record<HouseholdTypeKey, CategoryStats>
  }
}

export type AcsCell = {
  cell_id: string
  region: RegionKey
  sex: SexKey
  age_band: AgeBandKey
  pop: number
}

export type AcsCells = {
  meta: {
    year: number
    source: string
    table: string
    generatedAt: string
    universe?: string
    note?: string
  }
  total_pop: number
  cells: AcsCell[]
}

export type ModeledTraitKey = string

export type RegionSupport = 'modeled' | 'national_only'

export type TraitGroup = 'Health' | 'Hobbies' | 'Other'

export type TraitManifestEntry = {
  key: ModeledTraitKey
  label: string
  group: TraitGroup
  source: string
  type?: string
  universe?: string
  definition_notes?: string
  description?: string
  file?: string
  // Fields for UI gating
  minAge: number
  universeLabel: string
  regionSupport: RegionSupport
  notes?: string
}

export type TraitManifest = {
  traits: TraitManifestEntry[]
  generatedAt?: string
}

export type TraitProbabilityFile = {
  meta: Record<string, unknown>
  prob_by_cell: Record<string, number>
}

export type ModeledAssets = {
  acsCells: AcsCells
  manifest: TraitManifest
  traitProbabilities: Record<ModeledTraitKey, Record<string, number>>
}

export type AppData = {
  population: PopulationData
  modeled: ModeledAssets
}
