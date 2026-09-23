import { users } from './users.js'

const minutesAgo = (m) => Date.now() - m * 60 * 1000

export const notifications = [
  {
    id: 'n1',
    type: 'like',
    user: 'u5',
    postId: 'p1',
    textKey: 'liked your post',
    caption: 'Finished a fan art study this evening…',
    createdAt: minutesAgo(4),
    read: false,
  },
  {
    id: 'n2',
    type: 'follow',
    user: 'u3',
    textKey: 'started following you',
    createdAt: minutesAgo(15),
    read: false,
  },
  {
    id: 'n3',
    type: 'comment',
    user: 'u4',
    postId: 'p1',
    textKey: 'commented on your post',
    comment: 'This captures the mood so well ✨💜',
    createdAt: minutesAgo(38),
    read: false,
  },
  {
    id: 'n4',
    type: 'save',
    user: 'u7',
    reelId: 'r3',
    textKey: 'saved your Reel',
    createdAt: minutesAgo(70),
    read: false,
  },
  {
    id: 'n5',
    type: 'message',
    user: 'u2',
    textKey: 'sent you a message',
    preview: 'Hey! Are you going to the tour next month?',
    createdAt: minutesAgo(120),
    read: true,
  },
  {
    id: 'n6',
    type: 'mention',
    user: 'u6',
    postId: 'p6',
    textKey: 'mentioned you in a post',
    caption: 'New photocard in the binder and I rearranged…',
    createdAt: minutesAgo(185),
    read: true,
  },
  {
    id: 'n7',
    type: 'like',
    user: 'u8',
    postId: 'p5',
    textKey: 'liked your post',
    caption: 'The whole street lit up purple tonight…',
    createdAt: minutesAgo(260),
    read: true,
  },
  {
    id: 'n8',
    type: 'follow',
    user: 'u1',
    textKey: 'started following you',
    createdAt: minutesAgo(420),
    read: true,
  },
  {
    id: 'n9',
    type: 'comment',
    user: 'u7',
    postId: 'p5',
    textKey: 'commented on your post',
    comment: 'This makes my heart so full 💜',
    createdAt: minutesAgo(620),
    read: true,
  },
]

export function getUserFromNotification(n) {
  return users.find((u) => u.id === n.user) || users[0]
}
