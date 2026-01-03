import mapping from '../../config/traits/state_regions.json' assert { type: 'json' }

export const stateRegionMap = mapping as Record<string, 'northeast' | 'midwest' | 'south' | 'west'>

export const getRegionForState = (fips: string) => {
  const key = fips.padStart(2, '0')
  return stateRegionMap[key]
}
