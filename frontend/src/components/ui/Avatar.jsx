import { cn } from '../../utils/helpers.js'
import { makeErrorHandler, FALLBACK_IMG } from '../../utils/image.js'

export default function Avatar({ src, alt, size = 40, online, className, fallback }) {
  return (
    <span
      className={cn('avatar', `avatar--${size}`, className)}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img
          className="avatar__img"
          src={src}
          alt={alt || 'User'}
          loading="lazy"
          onError={makeErrorHandler(fallback || FALLBACK_IMG)}
        />
      ) : (
        <span className="avatar__fallback">💜</span>
      )}
      {online !== undefined && (
        <span
          className={cn('avatar__dot', online && 'avatar__dot--on')}
          aria-hidden="true"
        />
      )}
    </span>
  )
}
