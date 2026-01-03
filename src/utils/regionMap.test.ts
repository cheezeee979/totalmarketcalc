/// <reference types="vitest" />
import { describe, expect, it } from 'vitest'
import { getRegionForState } from './regionMap'

describe('state -> region mapping', () => {
  it('maps California to west', () => {
    expect(getRegionForState('06')).toBe('west')
  })

  it('maps New York to northeast', () => {
    expect(getRegionForState('36')).toBe('northeast')
  })

  it('maps Texas to south', () => {
    expect(getRegionForState('48')).toBe('south')
  })

  it('maps Illinois to midwest', () => {
    expect(getRegionForState('17')).toBe('midwest')
  })
})
