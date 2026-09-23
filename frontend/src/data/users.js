// Fictional ARMY users. No real-person identities are used.
// Avatars are local themed SVG marks (no copyrighted images).

const av = (name) => `/images/avatars/${name}.svg`

// Member photos come from the central BTS catalogue so URLs stay in one place.
import { BTS_MEMBERS } from './btsCatalogue.js'
const MEMBER_PHOTOS = {
  ...Object.fromEntries(BTS_MEMBERS.map((m) => [m.key, m.photoUrl])),
  group: 'https://static.wikia.nocookie.net/the-bangtan-boys/images/0/02/2C4S_1.png/revision/latest?cb=20170408135540',
  armybomb: '/images/bts/armybomb.svg',
}
const mbr = (name) => MEMBER_PHOTOS[name] || `/images/bts/${name}.svg`

export const users = [
  {
    id: 'u-me',
    username: 'you',
    displayName: 'New ARMY',
    isCurrentUser: true,
    country: 'Worldwide',
    flag: '🌍',
    avatar: av('av-you'),
    avatarArt: mbr('armybomb'),
    bio: 'Fresh on ARMYVERSE — here for the music, the memories, and the purple nights. 💜',
    followers: 12,
    following: 47,
    posts: 1,
    verified: false,
  },
  {
    id: 'u1',
    username: 'violet_sky315',
    displayName: 'Priya N.',
    country: 'India',
    flag: '🇮🇳',
    avatar: av('av-1'),
    avatarArt: mbr('rm'),
    bio: 'ARMY from Mumbai. Fan art, lyric studies, and way too many playlists. 💜',
    followers: 384,
    following: 219,
    posts: 1,
    verified: false,
  },
  {
    id: 'u2',
    username: 'season_of_bts',
    displayName: 'Camille R.',
    country: 'Canada',
    flag: '🇨🇦',
    avatar: av('av-2'),
    avatarArt: mbr('jin'),
    bio: 'Toronto ARMY. Concert-season is the best season. Saving up for the next tour. 🎤',
    followers: 126,
    following: 340,
    posts: 1,
    verified: false,
  },
  {
    id: 'u3',
    username: 'namjooning_daily',
    displayName: 'Ade B.',
    country: 'Kenya',
    flag: '🇰🇪',
    avatar: av('av-3'),
    avatarArt: mbr('suga'),
    bio: 'Nairobi ARMY. Breaking down every album concept, one line at a time. mono forever. 🫠',
    followers: 1420,
    following: 88,
    posts: 1,
    verified: true,
  },
  {
    id: 'u4',
    username: 'hobihope',
    displayName: 'Yuki M.',
    country: 'Japan',
    flag: '🇯🇵',
    avatar: av('av-4'),
    avatarArt: mbr('jhope'),
    bio: 'Tokyo ARMY ✨ Dance covers and Hope World energy since day one.',
    followers: 612,
    following: 402,
    posts: 1,
    verified: false,
  },
  {
    id: 'u5',
    username: 'borahae_br',
    displayName: 'Rafael S.',
    country: 'Brazil',
    flag: '🇧🇷',
    avatar: av('av-5'),
    avatarArt: mbr('jimin'),
    bio: 'São Paulo ARMY 💜 Birthday streams, purple nights, and endless Borahaes.',
    followers: 3860,
    following: 145,
    posts: 1,
    verified: true,
  },
  {
    id: 'u6',
    username: 'golden_maknea',
    displayName: 'Chloe P.',
    country: 'Australia',
    flag: '🇦🇺',
    avatar: av('av-6'),
    avatarArt: mbr('jungkook'),
    bio: 'Sydney ARMY. Photocard collector, binder obsessive, Golden ride-or-die.',
    followers: 98,
    following: 265,
    posts: 1,
    verified: false,
  },
  {
    id: 'u7',
    username: 'star_sea_v',
    displayName: 'Anika W.',
    country: 'Germany',
    flag: '🇩🇪',
    avatar: av('av-7'),
    avatarArt: mbr('v'),
    bio: 'Berlin ARMY. Concept analyses, Winter Bear, and cloudy melancholic vibes. 🎷',
    followers: 2310,
    following: 320,
    posts: 1,
    verified: false,
  },
  {
    id: 'u8',
    username: 'pta_jubilee',
    displayName: 'Tendai M.',
    country: 'South Africa',
    flag: '🇿🇦',
    avatar: av('av-8'),
    avatarArt: mbr('group'),
    bio: 'Cape Town ARMY. Community events and bake-offs. Smooth like butter, sweet like ARMY. 🧈',
    followers: 47,
    following: 510,
    posts: 1,
    verified: false,
  },
]

export function getUserById(id) {
  return users.find((u) => u.id === id) || users[0]
}

export function getUserAvatar(id, fallbackTo = 'avatar') {
  const u = getUserById(id)
  return u[fallbackTo] || u.avatar || av('av-you')
}
