import { memo, useState } from 'react'

const PASTEL_COLORS = [
  '#e4ece1', // soft sage
  '#f3e8df', // warm apricot / peach
  '#ede9df', // vintage linen
  '#e0e8eb', // soft dusk blue
  '#fae8e6', // soft rose
  '#eae6f0', // soft lavender
  '#f5eedb', // warm parchment
]

function getBookColor(id = '') {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
  }
  return PASTEL_COLORS[Math.abs(hash) % PASTEL_COLORS.length]
}

function BookCard({
  book,
  isFavorite,
  onToggleFavorite,
  onOpenPdf,
  isOpening = false,
  onManualBookmark,
  onEdit,
  onDelete,
}) {
  const progress = Math.max(
    0,
    Math.min(100, Number(book.reading_progress) || 0)
  )

  const [pageInput, setPageInput] = useState(
    String(book.last_read_page || 1)
  )
  const [savingBookmark, setSavingBookmark] = useState(false)
  const cardBg = book.color || getBookColor(String(book.id))

  async function handleBookmarkSubmit(event) {
    event.preventDefault()
    setSavingBookmark(true)
    try {
      await onManualBookmark(book.id, pageInput)
    } finally {
      setSavingBookmark(false)
    }
  }

  return (
    <article className="book-card">
      {/* Aesthetic Book Cover - Double Click opens directly in reader */}
      <div
        className={`book-cover ${book.coverUrl ? 'has-custom-cover' : 'has-spine-cover'}`}
        style={book.coverUrl ? undefined : { backgroundColor: cardBg }}
        onDoubleClick={() => onOpenPdf(book, 'web')}
        title="Double-click cover to open directly in reader mode"
      >
        {book.coverUrl ? (
          <img
            className="book-cover-image"
            src={book.coverUrl}
            alt={`Cover of ${book.title}`}
            loading="lazy"
          />
        ) : (
          <div className="cover-spine-layout">
            <span className="cover-decoration" aria-hidden="true">
              {book.cover || ''}
            </span>
            <span className="cover-title">{book.title}</span>
            {book.author && <span className="cover-author">{book.author}</span>}
          </div>
        )}

        {/* Favorite Heart Button */}
        <button
          type="button"
          className={`favorite-button ${isFavorite ? 'favorited' : ''}`}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFavorite(book.id)
          }}
          aria-label={`Toggle favorite for ${book.title}`}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? '♥' : '♡'}
        </button>

        {/* Top Card Management (Edit & Delete) */}
        <div className="card-manage-overlay" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <button
              type="button"
              className="card-tool-btn edit"
              onClick={() => onEdit(book)}
              title="Edit book details"
              aria-label={`Edit ${book.title}`}
            >
              ✎
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="card-tool-btn delete"
              onClick={() => onDelete(book.id, book.title)}
              title="Delete book from shelf"
              aria-label={`Delete ${book.title}`}
            >
              ✕
            </button>
          )}
        </div>

        <div className="double-click-hint">Double click to read</div>
      </div>

      {/* Book Metadata & Reading Actions */}
      <div className="book-info">
        <div className="book-title-block">
          <h3>{book.title}</h3>
          <p className="book-author-text">{book.author || 'Unknown author'}</p>
        </div>

        {book.genre && <span className="genre-tag">{book.genre}</span>}

        {/* Reading Progress */}
        <div className="book-progress-summary">
          <div className="book-progress-copy">
            <span>Progress</span>
            <strong>{progress}%</strong>
          </div>

          <div
            className="book-progress-track"
            role="progressbar"
            aria-label={`Reading progress for ${book.title}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>

          <small>
            {book.last_read_page
              ? `Page ${book.last_read_page}${
                  book.total_pages ? ` of ${book.total_pages}` : ''
                }`
              : 'Not started yet'}
          </small>
        </div>

        {/* Dual Reading Actions: Read on Web OR Default Reader App */}
        {book.pdf_path && (
          <div className="book-actions-group">
            <button
              type="button"
              className="read-pdf-primary-button"
              onClick={() => onOpenPdf(book, 'web')}
              disabled={isOpening}
              title="Open cozy in-website PDF reader"
            >
              {isOpening ? 'Opening...' : book.last_read_page ? 'Continue' : 'Read'}
            </button>

            <button
              type="button"
              className="read-pdf-cloud-button"
              onClick={() => onOpenPdf(book, 'cloud')}
              disabled={isOpening}
              title="Open in cloud tab or your default external PDF reader"
            >
              Default App
            </button>
          </div>
        )}

        {/* Bookmark Accordion for External Reading */}
        <details className="manual-bookmark">
          <summary>Reading in default reader?</summary>
          <form onSubmit={handleBookmarkSubmit} className="manual-bookmark-form">
            <label htmlFor={`bookmark-${book.id}`}>Set current page:</label>
            <div className="manual-bookmark-controls">
              <input
                id={`bookmark-${book.id}`}
                type="number"
                min="1"
                max={book.total_pages || undefined}
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                required
              />
              <button type="submit" disabled={savingBookmark}>
                {savingBookmark ? '...' : 'Save'}
              </button>
            </div>
            {!book.total_pages && (
              <small>
                Tip: Open once in the website reader to auto-detect total pages.
              </small>
            )}
          </form>
        </details>
      </div>
    </article>
  )
}

export default memo(BookCard)
