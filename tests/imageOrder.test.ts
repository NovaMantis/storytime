import { describe, expect, it } from 'vitest'
import { defaultImageOrder } from '../server/utils/validateProcessSelection'

describe('defaultImageOrder', () => {
  it('sorts filenames naturally', () => {
    expect(defaultImageOrder(['img-10.jpg', 'img-2.jpg', 'img-1.jpg']))
      .toEqual(['img-1.jpg', 'img-2.jpg', 'img-10.jpg'])
  })
})
