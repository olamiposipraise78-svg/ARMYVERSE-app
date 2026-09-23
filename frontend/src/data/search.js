// Trending tags + search index are derived from the central BTS catalogue so
// they always reflect the current (2026) state of the discography.

import { ALL_BTS_SONGS } from './btsCatalogue.js'

export const trending = [
  { tag: '#ARIRANG', count: '2.4M' },
  { tag: '#ComeOver', count: '1.8M' },
  { tag: '#BTSIsBack', count: '1.5M' },
  { tag: '#WorldTour2026', count: '1.2M' },
  { tag: '#YetToCome', count: '968K' },
  { tag: '#SpringDay', count: '612K' },
  { tag: '#Dynamite', count: '540K' },
]

const CORE_KEYWORDS = [
  'BTS',
  'ARMY',
  'Borahae',
  'Concert',
  'Album',
  'Photocards',
  'Fan Art',
  'Dance Cover',
]

const CATALOGUE_KEYWORDS = ALL_BTS_SONGS.flatMap((s) => [s.title, s.album, s.artist])
  .filter(Boolean)
  .map((k) => k.trim())
  .filter((k) => k.length > 2)

export const searchIndex = [...new Set([...CORE_KEYWORDS, ...CATALOGUE_KEYWORDS])].sort()