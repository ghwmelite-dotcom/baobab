import { IconButton } from '@baobab/ui'
import { useBookmarksStore } from './bookmarks.store'
import { useTabsStore } from '~/state/tabs.store'

export function BookmarkButton() {
  const tabs = useTabsStore((s) => s.tabs)
  const activeId = useTabsStore((s) => s.activeId)
  const activeTab = tabs.find((t) => t.id === activeId)
  const isBookmarked = useBookmarksStore((s) =>
    activeTab ? s.isBookmarked(activeTab.url) : false,
  )
  const findByUrl = useBookmarksStore((s) => s.findByUrl)
  const add = useBookmarksStore((s) => s.add)
  const remove = useBookmarksStore((s) => s.remove)

  const canBookmark = activeTab?.url && activeTab.url !== 'about:blank'

  const toggle = async () => {
    if (!canBookmark || !activeTab) return
    const existing = findByUrl(activeTab.url)
    if (existing) await remove(existing.id)
    else await add(activeTab.url, activeTab.title)
  }

  return (
    <IconButton
      aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
      onClick={() => void toggle()}
      disabled={!canBookmark}
      style={{ color: isBookmarked ? 'var(--accent)' : 'var(--text-secondary)' }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M8 1.5 L10 5.6 L14.5 6.2 L11.2 9.3 L12 13.5 L8 11.4 L4 13.5 L4.8 9.3 L1.5 6.2 L6 5.6 Z"
          stroke="currentColor"
          strokeWidth="1.2"
          fill={isBookmarked ? 'currentColor' : 'none'}
        />
      </svg>
    </IconButton>
  )
}
