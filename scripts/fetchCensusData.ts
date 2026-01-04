import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'

type ApiRow = Array<string>
type ApiRecord = Record<string, string>

const year = process.env.CENSUS_YEAR ?? '2024'
const apiKey = process.env.CENSUS_API_KEY
const base = `https://api.census.gov/data/${year}/acs/acs1`
const profileBase = `https://api.census.gov/data/${year}/acs/acs1/profile`

const fetchCensus = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Request failed: ${res.status} ${res.statusText} – ${text}`)
  }
  return (await res.json()) as ApiRow[]
}

const withKey = (url: string) => (apiKey ? `${url}&key=${apiKey}` : url)

const parseNumber = (value: string | undefined) => Number(value ?? 0)

const toRecord = (rows: ApiRow[]): ApiRecord => {
  const [header, values] = rows
  return header.reduce<ApiRecord>((acc, key, idx) => {
    acc[key] = values[idx]
    return acc
  }, {})
}

const ageCode = (n: number) => `B01001_${n.toString().padStart(3, '0')}E`

const run = async () => {
  console.log(`Fetching ACS ${year} data...`)

  const maleAgeCodes = Array.from({ length: 23 }, (_, idx) => ageCode(3 + idx)) // 003-025
  const femaleAgeCodes = Array.from({ length: 23 }, (_, idx) => ageCode(27 + idx)) // 027-049
  const ageFields = ['B01001_001E', 'B01001_002E', 'B01001_026E', ...maleAgeCodes, ...femaleAgeCodes]

  const totalUrl = withKey(`${base}?get=B01003_001E&for=us:1`)
  const ageUrl = withKey(`${base}?get=${ageFields.join(',')}&for=us:1`)
  const raceUrl = withKey(`${base}?get=B02001_001E,B02001_002E,B02001_003E,B02001_005E&for=us:1`)
  const regionUrl = withKey(`${base}?get=B01003_001E&for=region:*`)
  const employmentUrl = withKey(
    `${profileBase}?get=DP03_0001E,DP03_0004E,DP03_0005E,DP03_0007E&for=us:1`,
  )
  const childrenUrl = withKey(`${profileBase}?get=DP02_0001E,DP02_0006E&for=us:1`)
  // DP04 Vehicles Available (occupied housing units)
  // DP04_0058E = No vehicles, DP04_0059E = 1 vehicle, DP04_0060E = 2 vehicles, DP04_0061E = 3+ vehicles
  const vehiclesUrl = withKey(
    `${profileBase}?get=DP04_0058E,DP04_0059E,DP04_0060E,DP04_0061E&for=us:1`,
  )

  const [totalRows, ageRows, raceRows, regionRows, employmentRows, childrenRows, vehiclesRows] =
    await Promise.all([
      fetchCensus(totalUrl),
      fetchCensus(ageUrl),
      fetchCensus(raceUrl),
      fetchCensus(regionUrl),
      fetchCensus(employmentUrl),
      fetchCensus(childrenUrl),
      fetchCensus(vehiclesUrl),
    ])

  const totalPopulation = parseNumber(totalRows[1]?.[0])
  const ageRecord = toRecord(ageRows)
  const childrenRecord = toRecord(childrenRows)

  const maleCount = parseNumber(ageRecord['B01001_002E'])
  const femaleCount = parseNumber(ageRecord['B01001_026E'])

  const raceTotal = parseNumber(raceRows[1]?.[0])
  const whiteCount = parseNumber(raceRows[1]?.[1])
  const blackCount = parseNumber(raceRows[1]?.[2])
  const asianCount = parseNumber(raceRows[1]?.[3])
  const otherRaceCount = Math.max(raceTotal - whiteCount - blackCount - asianCount, 0)

  const regionCodeToKey: Record<string, 'northeast' | 'midwest' | 'south' | 'west'> = {
    '1': 'northeast',
    '2': 'midwest',
    '3': 'south',
    '4': 'west',
  }

  const regionCounts = regionRows.slice(1).reduce<Record<string, number>>((acc, row) => {
    const regionKey = regionCodeToKey[row[1]]
    if (regionKey) acc[regionKey] = parseNumber(row[0])
    return acc
  }, {})

  const employedCount = parseNumber(employmentRows[1]?.[1])
  const unemployedCount = parseNumber(employmentRows[1]?.[2])
  const notInLaborCount = parseNumber(employmentRows[1]?.[3])

  const ageBandCodes = {
    age0to17: [
      'B01001_003E',
      'B01001_004E',
      'B01001_005E',
      'B01001_006E',
      'B01001_027E',
      'B01001_028E',
      'B01001_029E',
      'B01001_030E',
    ],
    age18to34: [
      'B01001_007E',
      'B01001_008E',
      'B01001_009E',
      'B01001_010E',
      'B01001_011E',
      'B01001_012E',
      'B01001_031E',
      'B01001_032E',
      'B01001_033E',
      'B01001_034E',
      'B01001_035E',
      'B01001_036E',
    ],
    age35to54: [
      'B01001_013E',
      'B01001_014E',
      'B01001_015E',
      'B01001_016E',
      'B01001_037E',
      'B01001_038E',
      'B01001_039E',
      'B01001_040E',
    ],
    age55to74: [
      'B01001_017E',
      'B01001_018E',
      'B01001_019E',
      'B01001_020E',
      'B01001_021E',
      'B01001_022E',
      'B01001_041E',
      'B01001_042E',
      'B01001_043E',
      'B01001_044E',
      'B01001_045E',
      'B01001_046E',
    ],
    age75plus: [
      'B01001_023E',
      'B01001_024E',
      'B01001_025E',
      'B01001_047E',
      'B01001_048E',
      'B01001_049E',
    ],
  }

  const ageCounts = Object.entries(ageBandCodes).reduce<Record<string, number>>(
    (acc, [band, codes]) => {
      const count = codes.reduce((sum, code) => sum + parseNumber(ageRecord[code]), 0)
      acc[band] = count
      return acc
    },
    {},
  )

  const totalHouseholds = parseNumber(childrenRecord.DP02_0001E)
  const householdsWithChildren = parseNumber(childrenRecord.DP02_0006E)
  const householdChildShare = totalHouseholds ? householdsWithChildren / totalHouseholds : 0
  const hasChildrenCount = householdChildShare * totalPopulation
  const noChildrenCount = Math.max(totalPopulation - hasChildrenCount, 0)

  // Process vehicles data (household-based, approximated to person counts)
  const vehiclesRecord = toRecord(vehiclesRows)
  const noVehicleUnits = parseNumber(vehiclesRecord.DP04_0058E)
  const oneVehicleUnits = parseNumber(vehiclesRecord.DP04_0059E)
  const twoVehicleUnits = parseNumber(vehiclesRecord.DP04_0060E)
  const threePlusVehicleUnits = parseNumber(vehiclesRecord.DP04_0061E)
  const totalVehicleUnits = noVehicleUnits + oneVehicleUnits + twoVehicleUnits + threePlusVehicleUnits
  
  // Compute shares of housing units (used as approximate person share)
  const hasVehicleShare = totalVehicleUnits 
    ? (oneVehicleUnits + twoVehicleUnits + threePlusVehicleUnits) / totalVehicleUnits 
    : 0
  const noVehicleShare = totalVehicleUnits ? noVehicleUnits / totalVehicleUnits : 0
  
  // Approximate person counts by applying share to total population
  const hasVehicleCount = Math.round(hasVehicleShare * totalPopulation)
  const noVehicleCount = Math.round(noVehicleShare * totalPopulation)

  const share = (value: number) => (totalPopulation ? value / totalPopulation : 0)

  const dataset = {
    meta: {
      year: Number(year),
      source: 'ACS 1-year',
      generatedAt: new Date().toISOString(),
    },
    totalPopulation,
    dimensions: {
      sex: {
        male: { count: maleCount, share: share(maleCount) },
        female: { count: femaleCount, share: share(femaleCount) },
      },
      race: {
        white: { count: whiteCount, share: share(whiteCount) },
        black: { count: blackCount, share: share(blackCount) },
        asian: { count: asianCount, share: share(asianCount) },
        other: { count: otherRaceCount, share: share(otherRaceCount) },
      },
      region: {
        northeast: { count: regionCounts.northeast ?? 0, share: share(regionCounts.northeast ?? 0) },
        midwest: { count: regionCounts.midwest ?? 0, share: share(regionCounts.midwest ?? 0) },
        south: { count: regionCounts.south ?? 0, share: share(regionCounts.south ?? 0) },
        west: { count: regionCounts.west ?? 0, share: share(regionCounts.west ?? 0) },
      },
      employment: {
        employed: { count: employedCount, share: share(employedCount) },
        unemployed: { count: unemployedCount, share: share(unemployedCount) },
        notInLabor: { count: notInLaborCount, share: share(notInLaborCount) },
      },
      age: {
        age0to17: { count: ageCounts.age0to17 ?? 0, share: share(ageCounts.age0to17 ?? 0) },
        age18to34: { count: ageCounts.age18to34 ?? 0, share: share(ageCounts.age18to34 ?? 0) },
        age35to54: { count: ageCounts.age35to54 ?? 0, share: share(ageCounts.age35to54 ?? 0) },
        age55to74: { count: ageCounts.age55to74 ?? 0, share: share(ageCounts.age55to74 ?? 0) },
        age75plus: { count: ageCounts.age75plus ?? 0, share: share(ageCounts.age75plus ?? 0) },
      },
      children: {
        hasChildren: { count: hasChildrenCount, share: share(hasChildrenCount) },
        noChildren: { count: noChildrenCount, share: share(noChildrenCount) },
      },
      transport: {
        hasVehicle1plus: { count: hasVehicleCount, share: hasVehicleShare },
        noVehicle: { count: noVehicleCount, share: noVehicleShare },
      },
    },
  }

  const outputPath = path.resolve(process.cwd(), 'public', 'data', 'populationShares.json')
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8')

  console.log(`Saved dataset to ${outputPath}`)
}

run().catch((err) => {
  console.error('Failed to fetch Census data', err)
  process.exit(1)
})
