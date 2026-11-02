import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { CARD_POOL, cardBackFor, cardDesignKey, cardImageFor } from '../src/data/card-pool'

describe('branded card assets', () => {
  it('ships every reward face and matching face in both themes', () => {
    for (const theme of ['dark', 'light'] as const) {
      const images = new Set(CARD_POOL.map((card) => cardImageFor(card.name, theme)))
      images.add(cardBackFor(theme))
      images.add(`/cards/branded/${theme}/matching-back.svg`)
      images.add(`/cards/branded/${theme}/false-hope.svg`)
      for (let pair = 1; pair <= 10; pair++) images.add(`/cards/branded/${theme}/matching-${pair}.svg`)
      for (const image of images) {
        expect(image).toBeTruthy()
        const path = resolve('public', image!.slice(1))
        expect(existsSync(path), image!).toBe(true)
        expect(readFileSync(path, 'utf8')).toContain('FIGHT THE DRAGON')
      }
    }
  })
  it('keeps numbered copies and legacy names mapped to the same card identity', () => {
    expect(cardDesignKey({ name: 'Normal Heal Card #01', type: 'Normal' })).toBe(cardDesignKey({ name: 'Normal Heal Card #02', type: 'Normal' }))
    expect(cardImageFor('Epic Reflect Card #01')).toBe(cardImageFor('Epic Swallow Card #01'))
    expect(cardImageFor('Normal Heal Card #01', 'light')).toContain('/light/')
    expect(CARD_POOL).toHaveLength(60)
  })
  it('gives all ten matching pairs distinct pictures even without their captions', () => {
    const pictures = Array.from({ length: 10 }, (_, pair) => readFileSync(resolve('public/cards/branded/dark', `matching-${pair + 1}.svg`), 'utf8').replace(/<text\b[^>]*>.*?<\/text>/g, ''))
    expect(new Set(pictures).size).toBe(10)
  })
})
