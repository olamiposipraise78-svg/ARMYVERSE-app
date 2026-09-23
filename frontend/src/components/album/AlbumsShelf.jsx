import { useEffect, useState } from 'react'
import AlbumCard from './AlbumCard.jsx'
import { fetchAlbums } from '../../utils/api.js'
import { LoadingState, ErrorState } from '../ui/Status.jsx'
import { cn } from '../../utils/helpers.js'

export default function AlbumsShelf({ compact = false, limit = 6 }) {
  const [state, setState] = useState({ status: 'loading', albums: [] })

  useEffect(() => {
    let active = true
    fetchAlbums()
      .then((res) => active && setState({ status: 'ok', albums: res.data }))
      .catch(() => active && setState({ status: 'error', albums: [] }))
    return () => {
      active = false
    }
  }, [])

  if (state.status === 'loading') {
    return <LoadingState label="Loading albums…" />
  }
  if (state.status === 'error') {
    return <ErrorState message="Couldn’t load the discography." />
  }

  return (
    <div className={cn('albums-grid', compact && 'albums-grid--compact')}>
      {state.albums.slice(0, limit).map((album) => (
        <AlbumCard key={album.id} album={album} compact={compact} />
      ))}
    </div>
  )
}
