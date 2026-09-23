// Fictional ARMY story moments. No real-person identities are used.
// Story media are local themed SVG marks (no copyrighted images).

export const stories = [
  {
    id: 'st-1',
    user: 'u3',
    src: '/images/posts/post-concert-crowd.svg',
    color: '#2b1a4a',
    caption: 'Purple lights turning the whole arena into a sea of ARMY bombs 💜',
    viewers: 1240,
    timestamp: '2026-08-31T09:00:00Z',
  },
  {
    id: 'st-2',
    user: 'u1',
    src: '/images/posts/post-fanart.svg',
    color: '#3a1d55',
    caption: 'New fan art drop — this one took all weekend 🎨',
    viewers: 861,
    timestamp: '2026-08-31T08:30:00Z',
  },
  {
    id: 'st-3',
    user: 'u5',
    src: '/images/reels/reel-lights.svg',
    color: '#4a1838',
    caption: 'Birthday stream starting in 20 — the energy is unreal 🔥',
    viewers: 2034,
    timestamp: '2026-08-31T07:45:00Z',
  },
  {
    id: 'st-4',
    user: 'u4',
    src: '/images/posts/post-dance.svg',
    color: '#24365e',
    caption: 'Dance cover rehearsal 🕺 Hope World energy all day',
    viewers: 512,
    timestamp: '2026-08-31T06:30:00Z',
  },
  {
    id: 'st-5',
    user: 'u7',
    src: '/images/community/cm-stage.svg',
    color: '#3d2a50',
    caption: 'Concept analysis thread — winter bear vibes 🎷❄️',
    viewers: 998,
    timestamp: '2026-08-31T05:15:00Z',
  },
  {
    id: 'st-6',
    user: 'u2',
    src: '/images/bts/armybomb.svg',
    color: '#3c2447',
    caption: 'Saved this for tour season. Purple forever 🫶',
    viewers: 640,
    timestamp: '2026-08-31T04:00:00Z',
  },
]

export function getStoryById(id) {
  return stories.find((s) => s.id === id) || null
}
