// "Guess the BTS Song" question pool — every question is derived from the
// central BTS catalogue (btsCatalogue.js) so titles always match the previewed
// audio. Only songs with a verified Deezer preview are included.

import { ALL_BTS_SONGS } from './btsCatalogue.js'

const byId = Object.fromEntries(ALL_BTS_SONGS.map((s) => [s.id, s]))

// Track catalogue id → { difficulty, hint }
const SONG_META = {
  // ── Easy ─────────────────────────────────────────────────────────────────
  dynamite: { difficulty: 'easy', hint: "BTS's first all-English single, released August 2020" },
  butter: { difficulty: 'easy', hint: 'Released May 2021, stayed at #1 on Billboard Hot 100 for seven weeks' },
  'permission-to-dance': { difficulty: 'easy', hint: 'Released July 2021, co-written by Ed Sheeran' },
  'life-goes-on': { difficulty: 'easy', hint: 'From the "BE" album (2020), about life during the pandemic' },
  'boy-with-luv': { difficulty: 'easy', hint: 'Featuring Halsey, released April 2019' },
  dna: { difficulty: 'easy', hint: 'Released September 2017, the song that broke into Western markets' },
  idol: { difficulty: 'easy', hint: 'From the "Love Yourself: Answer" album, inspired by Korean traditional music' },
  'spring-day': { difficulty: 'easy', hint: 'Released in February 2017, a song about longing and hope' },
  'fake-love': { difficulty: 'easy', hint: 'From the "Love Yourself: Tear" album (2018)' },
  'take-two': { difficulty: 'easy', hint: 'BTS’s 2023 fan-song single marking 10 years together' },
  '3d-golden': { difficulty: 'easy', hint: 'Jung Kook’s playful 2023 solo hit recorded with Jack Harlow' },
  seven: { difficulty: 'easy', hint: 'Jung Kook’s record-breaking 2023 smash featuring Latto' },
  friendlys: { difficulty: 'easy', hint: 'V’s 2024 pop single about friends becoming more' },
  'super-tuna': { difficulty: 'easy', hint: 'Jin’s joyful 2024 novelty single about tuna fishing' },
  'ill-be-there': { difficulty: 'easy', hint: 'Jin’s uplifting 2024 single leading the "Happy" EP' },
  'mona-lisa': { difficulty: 'easy', hint: 'j-hope’s 2025 solo single self-titled after the song itself' },
  'killing-it-girl': { difficulty: 'easy', hint: 'j-hope’s 2025 disco-pop summer single' },
  'come-over': { difficulty: 'easy', hint: 'BTS’s 2026 single released after the ARIRANG album' },
  'body-to-body': { difficulty: 'easy', hint: 'Opening track of BTS’s 2026 album ARIRANG' },
  'swim': { difficulty: 'easy', hint: 'Title track of BTS’s 2026 studio album ARIRANG' },
  'merry-go-round': { difficulty: 'easy', hint: 'From ARIRANG (2026) — playful and nostalgic' },
  'one-more-night': { difficulty: 'easy', hint: 'A 2026 ARIRANG cut that begs the night to last longer' },

  // ── Medium ───────────────────────────────────────────────────────────────
  'mic-drop-remix': { difficulty: 'medium', hint: 'Known for its powerful performance and remix featuring Steve Aoki' },
  'not-today': { difficulty: 'medium', hint: 'From the "You Never Walk Alone" album, a message of perseverance' },
  'save-me': { difficulty: 'medium', hint: 'A mid-tempo dance track from "The Most Beautiful Moment in Life: Young Forever"' },
  fire: { difficulty: 'medium', hint: 'Known for its explosive "Fire" chorus and fiery choreography' },
  dope: { difficulty: 'medium', hint: 'Famous for its sharp "Dope... Dope... Dope" hook and police-uniform MV' },
  run: { difficulty: 'medium', hint: 'From "The Most Beautiful Moment in Life" series, a song about youthful passion' },
  danger: { difficulty: 'medium', hint: 'From the "DARK&WILD" album (2014), about a toxic relationship' },
  'answer-love-myself': { difficulty: 'medium', hint: 'An anthem about self-love from "Love Yourself: Answer"' },
  'converse-high': { difficulty: 'medium', hint: 'A playful ode to a crush from "The Most Beautiful Moment in Life Pt.1"' },
  'let-me-know': { difficulty: 'medium', hint: 'From the "DARK&WILD" album, a plea for honest communication' },
  "don-t-leave-me": { difficulty: 'medium', hint: 'A Japanese single that was the theme song for "Signal"' },
  'blood-sweat-tears': { difficulty: 'medium', hint: 'A sultry, moody hit from the "Wings" album (2016)' },
  'like-crazy': { difficulty: 'medium', hint: 'Jimin’s English-sung 2023 title track from FACE' },
  'set-me-free-pt2': { difficulty: 'medium', hint: 'Jimin’s intense 2023 single featuring a rap intro' },
  'slow-dancing': { difficulty: 'medium', hint: 'V’s 2023 title track from Layover, soft and jazzy' },
  'love-me-again': { difficulty: 'medium', hint: 'A smooth 2023 track from V’s Layover' },
  'd-day': { difficulty: 'medium', hint: 'Title track of SUGA’s final Agust D album (2023)' },
  'on-the-street': { difficulty: 'medium', hint: 'j-hope’s 2023 farewell single with J. Cole' },
  'standing-next-to-you': { difficulty: 'medium', hint: 'Jung Kook’s 2023 retro-funk lead from GOLDEN' },
  'never-let-go': { difficulty: 'medium', hint: 'Jung Kook’s 2024 fan-dedicated single' },
  who: { difficulty: 'medium', hint: 'Jimin’s 2024 title track from MUSE' },
  'smeraldo': { difficulty: 'medium', hint: 'Jimin’s 2024 pre-release with Loco about a flower of secrets' },
  'running-wild': { difficulty: 'medium', hint: 'Jin’s 2024 rock-tinged single from the "Happy" EP' },
  'winter-ahead': { difficulty: 'medium', hint: 'V’s 2024 Christmas duet with PARK HYO SHIN' },
  'white-christmas': { difficulty: 'medium', hint: 'A 2024 winter duet pairing V with a classic crooner' },
  'close-to-you': { difficulty: 'medium', hint: 'Jin’s 2025 OST for the series "Meet You at the Blossom"' },
  'sweet-dreams': { difficulty: 'medium', hint: 'j-hope’s 2025 single with Miguel' },
  lvbag: { difficulty: 'medium', hint: 'j-hope’s 2025 laid-back single about patience' },
  20: { difficulty: 'medium', hint: '"2.0" — a track from BTS’s 2026 album ARIRANG' },
  'no-29': { difficulty: 'medium', hint: 'From ARIRANG (2026), inspired by room number 29' },
  'normal': { difficulty: 'medium', hint: 'A dreamy wish-for-normalcy song from ARIRANG (2026)' },
  "they-dont-know-bout-us": { difficulty: 'medium', hint: 'A defiant 2026 ARIRANG track about being overlooked' },
  please: { difficulty: 'medium', hint: 'From ARIRANG (2026), a heartfelt request told in the chorus' },

  // ── Hard ─────────────────────────────────────────────────────────────────
  serendipity: { difficulty: 'hard', hint: 'Jimin’s solo from "Love Yourself" — soft, dreamy, and full of longing' },
  lie: { difficulty: 'hard', hint: 'Jimin’s intense solo from the "Wings" album (2016)' },
  stigma: { difficulty: 'hard', hint: 'V’s soulful, bluesy solo from the "Wings" album (2016)' },
  singularity: { difficulty: 'hard', hint: 'V’s jazzy solo from the "Love Yourself: Tear" album' },
  awake: { difficulty: 'hard', hint: 'Jin’s emotional solo from the "Wings" album (2016)' },
  epiphany: { difficulty: 'hard', hint: 'Jin’s powerful solo about learning to love yourself' },
  moon: { difficulty: 'hard', hint: 'Jin’s sweet, upbeat solo about loving ARMY' },
  'just-one-day': { difficulty: 'hard', hint: 'From "Skool Luv Affair" (2014), a wish to spend one day with a loved one' },
  'outro-wings': { difficulty: 'hard', hint: 'From the "Wings" album (2016), about following your dreams' },
  'wabp-eternal': { difficulty: 'hard', hint: 'From the "Proof" anthology album (2022), reflecting on their journey' },
  'blue-grey': { difficulty: 'hard', hint: 'A melancholic ballad from the "BE" album about depression' },
  'dis-ease': { difficulty: 'hard', hint: 'A genre-blending track from the "BE" album about burnout and creativity' },
  'hold-me-tight': { difficulty: 'hard', hint: 'A fan-favorite B-side from "The Most Beautiful Moment in Life Pt.1"' },
  haegeum: { difficulty: 'hard', hint: 'SUGA’s 2023 Agust D single about breaking free from restraints' },
  'rainy-days': { difficulty: 'hard', hint: 'A moody R&B memory from V’s Layover (2023)' },
  blue: { difficulty: 'hard', hint: 'A hybrid pop-jazz track on V’s Layover (2023)' },
  'for-us': { difficulty: 'hard', hint: 'Closing track of V’s Layover (2023) — the calm after the storm' },
  'yes-or-no': { difficulty: 'hard', hint: 'Jung Kook’s 2023 bouncy single from the GOLDEN sessions' },
  'come-back-to-me': { difficulty: 'hard', hint: 'RM’s 2024 lead single from Right Place, Wrong Person' },
  nuts: { difficulty: 'hard', hint: 'RM’s 2024 alt-pop lead about the absurdity of fame' },
  'lost-rpwp': { difficulty: 'hard', hint: 'RM’s 2024 funk-pop track featured on Right Place, Wrong Person' },
  'around-the-world': { difficulty: 'hard', hint: 'RM’s 2024 collaboration with Moses Sumney' },
  'closer-than-this': { difficulty: 'hard', hint: 'Jimin’s 2023 fan song released ahead of enlistment' },
  falling: { difficulty: 'hard', hint: 'Jin’s 2024 duet with TAKA, featuring melodica melodies' },
  hooligan: { difficulty: 'hard', hint: 'A brash, beat-heavy ARIRANG (2026) track' },
  aliens: { difficulty: 'hard', hint: 'An eccentric science-fiction cut from ARIRANG (2026)' },
  'like-animals': { difficulty: 'hard', hint: 'A wild, primal track near the end of ARIRANG (2026)' },
  'into-the-sun': { difficulty: 'hard', hint: 'Closing track of ARIRANG (2026), a sunrise after the night' },
}

export default Object.entries(SONG_META)
  .map(([trackId, meta]) => {
    const s = byId[trackId]
    if (!s) return null
    return {
      id: `gs-${trackId}`,
      difficulty: meta.difficulty,
      deezerId: s.deezerId,
      title: s.title,
      hint: meta.hint,
      album: s.album,
      previewAvailable: s.previewAvailable,
    }
  })
  .filter(Boolean)