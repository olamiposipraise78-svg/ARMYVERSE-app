import { cn } from '../../utils/helpers.js'

function Spinner() {
  return (
    <span className="spinner" role="status" aria-label="Loading">
      <span className="spinner__ring" aria-hidden="true" />
    </span>
  )
}

export function PageLoader({ label = 'Loading' }) {
  return (
    <div className="status status--page" role="status">
      <Spinner />
      <p className="status__label">{label}</p>
    </div>
  )
}

export function LoadingState({ label = 'Loading…', className }) {
  return (
    <div className={cn('status', className)} role="status">
      <Spinner />
      <p className="status__label">{label}</p>
    </div>
  )
}

export function EmptyState({ title = 'Nothing here yet', message, icon = '💜', action }) {
  return (
    <div className="state state--empty">
      <span className="state__icon" aria-hidden="true">
        {icon}
      </span>
      <h3 className="state__title">{title}</h3>
      {message && <p className="state__msg">{message}</p>}
      {action && <div className="state__action">{action}</div>}
    </div>
  )
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div className="state state--error">
      <span className="state__icon" aria-hidden="true">
        ⚠️
      </span>
      <h3 className="state__title">{title}</h3>
      {message && <p className="state__msg">{message}</p>}
      {onRetry && (
        <button className="btn btn--secondary btn--sm state__action" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
