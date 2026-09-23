import { users } from './users.js'

// Topic artwork: real BTS photos/artwork from Wikimedia Commons, hotlinked
// from the reliable upload.wikimedia.org image CDN (member portraits, group
// shots, concerts, and album artwork). Local SVG remains as the fallback.
const cm = (name) => `/images/community/${name}.svg`
const bts = (name) => `/images/bts/${name}.svg`

const wc = {
  group:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/BTS_photo-49.jpg/960px-BTS_photo-49.jpg',
  rm: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/72/BTS_RM_and_V_military_discharge%2C_10_June_2025_03.png/960px-BTS_RM_and_V_military_discharge%2C_10_June_2025_03.png',
  jin: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Jin_and_Jungkook_of_BTS_at_Seoul_Music_Awards%2C_19_January_2017_02.png/960px-Jin_and_Jungkook_of_BTS_at_Seoul_Music_Awards%2C_19_January_2017_02.png',
  suga: 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Min_Yoon-gi_May_2018.jpg',
  jhope:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/J-Hope_for_BTS_5th_anniversary_party_in_LA_photoshoot_by_Dispatch%2C_May_2018_01.jpg/960px-J-Hope_for_BTS_5th_anniversary_party_in_LA_photoshoot_by_Dispatch%2C_May_2018_01.jpg',
  jimin:
    'https://upload.wikimedia.org/wikipedia/commons/3/33/Jimin_on_the_way_to_SBS_Radio%2C_31_March_2023_%282%29.jpg',
  v: 'https://upload.wikimedia.org/wikipedia/commons/3/34/V_%28Kim_Tae-hyung%29_performing_at_the_TRB_in_Taipei_02_%28cropped%29.jpg',
  jungkook:
    'https://upload.wikimedia.org/wikipedia/commons/0/09/Jeon_Jung-kook_during_The_Wings_Tour%2C_2017.png',
  concerts:
    'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/BTS_in_concert_at_Wembley_Stadium%2C_2_June_2019_02.jpg/960px-BTS_in_concert_at_Wembley_Stadium%2C_2_June_2019_02.jpg',
  eras: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/170529_BTS_at_a_press_conference_for_the_BBMAs_%282%29.png/960px-170529_BTS_at_a_press_conference_for_the_BBMAs_%282%29.png',
}

const minutesAgo = (m) => Date.now() - m * 60 * 1000

export const communityTopics = [
  { slug: 'bts', label: 'BTS', icon: '💜', blurb: 'Everything about the group as a whole.', posts: 1204, art: wc.group, fallback: bts('group') },
  { slug: 'rm', label: 'RM', icon: '🎨', blurb: 'Joonie discussions, lyrics & art.', posts: 402, art: wc.rm, fallback: bts('rm') },
  { slug: 'jin', label: 'Jin', icon: '🦭', blurb: 'Worldwide Handsome appreciation space.', posts: 318, art: wc.jin, fallback: bts('jin') },
  { slug: 'suga', label: 'SUGA', icon: '🎹', blurb: 'Agust D, production & rap talk.', posts: 356, art: wc.suga, fallback: bts('suga') },
  { slug: 'jhope', label: 'j-hope', icon: '☀️', blurb: 'Hope World, dance & sunshine energy.', posts: 388, art: wc.jhope, fallback: bts('jhope') },
  { slug: 'jimin', label: 'Jimin', icon: '🎭', blurb: 'The stunning performer discussions.', posts: 374, art: wc.jimin, fallback: bts('jimin') },
  { slug: 'v', label: 'V', icon: '🎷', blurb: 'Winter Bear, jazz & dreamy vibes.', posts: 341, art: wc.v, fallback: bts('v') },
  { slug: 'jungkook', label: 'Jung Kook', icon: '🎤', blurb: 'Golden maknae fan space.', posts: 429, art: wc.jungkook, fallback: bts('jungkook') },
  { slug: 'albums', label: 'Albums', icon: '📀', blurb: 'Album-by-album deep dives.', posts: 515, art: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/BTS_-_Mic_Drop.jpg/960px-BTS_-_Mic_Drop.jpg', fallback: cm('cm-albums') },
  { slug: 'songs', label: 'Songs', icon: '🎧', blurb: 'Song discussions, lyrics & covers.', posts: 682, art: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Bts_Dynamite_2.svg/960px-Bts_Dynamite_2.svg.png', fallback: cm('cm-songs') },
  { slug: 'concerts', label: 'Concerts', icon: '🌟', blurb: 'Concert memories, tips & planning.', posts: 447, art: wc.concerts, fallback: bts('group') },
  { slug: 'eras', label: 'BTS eras', icon: '⏳', blurb: 'From debut to today — era reviews.', posts: 372, art: wc.eras, fallback: bts('group') },
  { slug: 'army', label: 'ARMY discussions', icon: '💬', blurb: 'Community-wide conversations.', posts: 890, art: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/BTS_at_a_fansigning_event%2C_16_May_2015.jpg/960px-BTS_at_a_fansigning_event%2C_16_May_2015.jpg', fallback: bts('armybomb') },
]

export const communityByTopic = {
  concerts: [
    {
      id: 'ct-c1',
      user: 'u2',
      createdAt: minutesAgo(45),
      text: 'Has anyone planned the outfit for the next tour date yet? I need inspo for the purple night — so hyped. 💜🎤',
      hashtags: ['#TourFashion', '#ConcertPlans'],
      replies: 31,
    },
    {
      id: 'ct-c2',
      user: 'u5',
      createdAt: minutesAgo(210),
      text: 'Tip for first-timers: arrive early, hydrate, and grab a light-stick holder. You’ll thank me later.',
      hashtags: ['#ConcertTips', '#FirstTimeARMY'],
      replies: 47,
    },
  ],
  albums: [
    {
      id: 'ct-a1',
      user: 'u6',
      createdAt: minutesAgo(130),
      text: 'Group-order thread: which version are we collecting this comeback? I’m leaning toward the concept versions this time.',
      hashtags: ['#Comeback', '#AlbumCollecting'],
      replies: 39,
    },
  ],
  songs: [
    {
      id: 'ct-s1',
      user: 'u1',
      createdAt: minutesAgo(85),
      text: 'That bridge in the anniversary single? Instant tears. Every. Single. Time. 🫠🎵',
      hashtags: ['#Anniversary', '#OnRepeat'],
      replies: 22,
    },
  ],
  army: [
    {
      id: 'ct-arm1',
      user: 'u8',
      createdAt: minutesAgo(65),
      text: 'Gentle reminder to be kind to each other — we’re one global family, and every ARMY’s journey matters. 💜',
      hashtags: ['#ARMYLove', '#Community'],
      replies: 63,
    },
  ],
  bts: [
    {
      id: 'ct-b1',
      user: 'u7',
      createdAt: minutesAgo(95),
      text: 'Which era do you keep returning to and why? Mine is SpeaK yourself-era — the set design was pure cinema.',
      hashtags: ['#WingsEra', '#BTS'],
      replies: 71,
    },
  ],
}

export function getTopicImage(slug) {
  const t = communityTopics.find((t) => t.slug === slug)
  return t ? t.art || t.fallback : cm('cm-group')
}

export function getTopicFallback(slug) {
  const t = communityTopics.find((t) => t.slug === slug)
  return t ? t.fallback : cm('cm-group')
}

export function findTopicByLabel(label) {
  return communityTopics.find(
    (t) => t.label.toLowerCase() === label.toLowerCase()
  )
}
