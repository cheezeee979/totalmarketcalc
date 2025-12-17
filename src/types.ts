export type SexKey = 'male' | 'female'
export type RaceKey = 'white' | 'black' | 'asian' | 'other'
export type RegionKey = 'northeast' | 'midwest' | 'south' | 'west'
export type EmploymentKey = 'employed' | 'unemployed' | 'notInLabor'
export type AgeKey = 'age0to17' | 'age18to34' | 'age35to54' | 'age55to74' | 'age75plus'
export type ChildrenKey = 'hasChildren' | 'noChildren'

export type DimensionName = 'sex' | 'race' | 'region' | 'employment' | 'age' | 'children'

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
  }
}
