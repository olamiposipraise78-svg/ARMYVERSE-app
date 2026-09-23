import { users } from './users.js'

const minutesAgo = (m) => Date.now() - m * 60 * 1000

export const conversations = [
  {
    id: 'c1',
    user: 'u2',
    online: true,
    lastMessage: 'Are you joining the watch party this weekend?',
    lastTime: minutesAgo(6),
    unread: 2,
  },
  {
    id: 'c2',
    user: 'u5',
    online: false,
    lastMessage: 'That bake-off recap was so cute 😄💜',
    lastTime: minutesAgo(95),
    unread: 0,
  },
  {
    id: 'c3',
    user: 'u4',
    online: true,
    lastMessage: 'Sharing the dance-cover rehearsal cut!',
    lastTime: minutesAgo(170),
    unread: 0,
  },
  {
    id: 'c4',
    user: 'u7',
    online: false,
    lastMessage: 'The new Winter Bear edit is live 🎷',
    lastTime: minutesAgo(330),
    unread: 0,
  },
]

export const messagesByConversation = {
  c1: [
    { id: 'm1', from: 'other', text: 'Hey! Are you going to the tour next month?', time: minutesAgo(32) },
    { id: 'm2', from: 'me', text: 'Yes!! Secured my tickets and I’m still shaking 😭', time: minutesAgo(30) },
    { id: 'm3', from: 'me', text: 'Hotel’s booked and everything.', time: minutesAgo(29) },
    { id: 'm4', from: 'other', text: 'The concert-season energy is real 🙌', time: minutesAgo(8) },
    { id: 'm5', from: 'other', text: 'Are you joining the watch party this weekend?', time: minutesAgo(6) },
  ],
  c2: [
    { id: 'm1', from: 'other', text: 'That bake-off recap was so cute 😄💜', time: minutesAgo(100) },
    { id: 'm2', from: 'me', text: 'Haha thanks! The purple icing was the real star.', time: minutesAgo(99) },
    { id: 'm3', from: 'other', text: 'You should host the next community event!', time: minutesAgo(96) },
  ],
  c3: [
    { id: 'm1', from: 'me', text: 'Can’t wait to see the full routine!', time: minutesAgo(175) },
    { id: 'm2', from: 'other', text: 'Sharing the dance-cover rehearsal cut!', time: minutesAgo(170) },
  ],
  c4: [
    { id: 'm1', from: 'other', text: 'The new Winter Bear edit is live 🎷', time: minutesAgo(335) },
    { id: 'm2', from: 'me', text: 'On my way to watch it right now.', time: minutesAgo(334) },
    { id: 'm3', from: 'other', text: 'Let me know what you think 💜', time: minutesAgo(331) },
  ],
}

export function getConversationUser(id) {
  const c = conversations.find((c) => c.id === id)
  if (!c) return null
  return { ...(users.find((u) => u.id === c.user) || users[0]), online: c.online }
}
