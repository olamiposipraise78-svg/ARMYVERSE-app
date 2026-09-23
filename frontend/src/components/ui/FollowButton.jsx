import { useApp } from '../../context/AppContext.jsx'
import Button from './Button.jsx'

export default function FollowButton({ userId, size = 'sm' }) {
  const { isFollowing, toggleFollow } = useApp()
  const following = isFollowing(userId)
  return (
    <Button
      size={size}
      variant={following ? 'following' : 'follow'}
      onClick={() => toggleFollow(userId)}
      aria-pressed={following}
    >
      {following ? 'Following' : 'Follow'}
    </Button>
  )
}
