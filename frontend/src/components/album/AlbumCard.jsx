import { makeErrorHandler } from '../../utils/image.js'
import { cn } from '../../utils/helpers.js'
import './album.css'

export default function AlbumCard({ album, compact = false }) {
  return (
    <article className={cn('album-card', compact && 'album-card--compact')}>
      <div className="album-card__cover">
        <img
          className="album-card__img"
          src={album.cover}
          alt={`${album.name} — ${album.artist} album cover`}
          loading="lazy"
          onError={makeErrorHandler(album.fallback)}
        />
      </div>
      <div className="album-card__body">
        <h3 className="album-card__title">{album.name}</h3>
        <div className="album-card__meta">
          <span className="album-card__artist">{album.artist}</span>
          <span className="album-card__type">{album.type}</span>
        </div>
        <time className="album-card__release">Released {album.release}</time>
        {!compact && <p className="album-card__desc">{album.description}</p>}
        {album.tags?.length > 0 && (
          <div className="album-card__tags">
            {album.tags.map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
