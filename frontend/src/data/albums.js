// Albums shelf — derived from the central BTS catalogue (btsCatalogue.js).
// Display-only fields (descriptions, tags) are curated here; release facts,
// artwork URLs and track lists all come from the catalogue.

import {
  BTS_CATALOGUE,
  getAlbumById as getCatalogueAlbum,
  releaseTypeLabel,
  formatReleaseDate,
} from './btsCatalogue.js'
import { fallbackFor } from '../utils/image.js'

// Curated showcase order — a spread of milestones from debut to ARIRANG.
const FEATURED_IDS = [
  'arirang',
  'jin-happy',
  'rm-rpwp',
  'jungkook-golden',
  'v-layover',
  'jimin-face',
  'come-over',
  'proof',
  'dynamite-single',
  'ly-answer',
  'wings',
  '2cool4skool',
]

const PLAYBLURB = {
  arirang: 'BTS’s first studio album as a full reunited septet — fourteen tracks of classic BTS energy, released March 20, 2026.',
  'come-over': 'The follow-up single from the ARIRANG era, released June 12, 2026.',
  'jin-happy': 'Jin’s solo EP built on honesty and hope — led by “I’ll Be There” and “Running Wild.”',
  'rm-rpwp': 'RM’s introspective 2024 solo album exploring identity through experimental, alt-rock and funk pop.',
  'jungkook-golden': 'Jung Kook’s record-breaking solo debut album, featuring “Seven” and “Standing Next to You.”',
  'v-layover': 'V’s mellow, jazz-flavored solo debut — a late-night tape led by “Slow Dancing.”',
  'jimin-face': 'Jimin’s raw solo debut confronting burnout and freedom, led by “Face-Off” and “Like Crazy.”',
  proof: 'The 2022 anthology tracing BTS’s journey from debut to global stardom, anchored by “Yet To Come.”',
  'dynamite-single': 'BTS’s first all-English single and their first Billboard Hot 100 #1 — a disco-pop wave of 2020.',
  'ly-answer': 'The conclusion of the Love Yourself era, gathering “IDOL,” “Epiphany” and the self-love story.',
  wings: 'The 2016 album that gave every member a solo and delivered “Blood Sweat & Tears” to the world.',
  '2cool4skool': 'Where it all began — BTS’s rebellious hip-hop debut, “No More Dream,” on June 12, 2013.',
}

const CUSTOM_TAGS = {
  'come-over': ['#ARIRANG', '#2026'],
  'dynamite-single': ['#Dynamite', '#DiscoPop', '#No1'],
  proof: ['#Anthology', '#YetToCome'],
  '2cool4skool': ['#Debut', '#NoMoreDream', '#2013'],
}

export const albums = FEATURED_IDS.map((id) => {
  const a = getCatalogueAlbum(id)
  if (!a) return null
  return {
    id: a.id,
    name: a.title,
    artist: a.artist,
    type: releaseTypeLabel(a.type),
    release: formatReleaseDate(a.releaseDate),
    cover: a.imageUrl || fallbackFor(a.title),
    fallback: null,
    description: PLAYBLURB[a.id] || a.description || `${a.title} — ${a.artist}.`,
    tags: CUSTOM_TAGS[a.id] || ['#BTS'],
  }
}).filter(Boolean)

export function getAlbumById(id) {
  return albums.find((a) => a.id === id) || albums[0]
}

export { BTS_CATALOGUE }