import Icon from '../ui/Icon.jsx'
import { cn } from '../../utils/helpers.js'
import './music.css'

export default function MusicSticker({
  song,
  playing = false,
  onToggle,
  className,
  compact = false,
}) {
  if (!song) return null
  return (
    <div className={cn('music-sticker', compact && 'music-sticker--compact', className)}>
      {song.artworkUrl || song.cover ? (
        <img className="music-sticker__cover" src={song.artworkUrl || song.cover} alt="" loading="lazy" />
      ) : (
        <span className="music-sticker__fallback">
          <Icon name="note" size={16} />
        </span>
      )}
      <div className="music-sticker__info">
        <span className={cn('music-sticker__title', playing && 'music-sticker__title--playing')}>
          {song.title}
        </span>
        {!compact && <span className="music-sticker__artist">{song.artist}</span>}
      </div>
      {onToggle && (
        <button
          className="music-sticker__toggle"
          onClick={onToggle}
          aria-label={playing ? 'Pause music' : 'Play music'}
        >
          <Icon name={playing ? 'mute' : 'volume'} size={16} />
        </button>
      )}
    </div>
  )
}
