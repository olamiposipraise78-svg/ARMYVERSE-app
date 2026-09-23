import { cn } from '../../utils/helpers.js'

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth,
  loading,
  icon,
  className,
  disabled,
  ...rest
}) {
  return (
    <button
      className={cn(
        'btn',
        `btn--${variant}`,
        `btn--${size}`,
        fullWidth && 'btn--full',
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="btn__spinner" aria-hidden="true" />
      ) : (
        icon && <span className="btn__icon">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  )
}
