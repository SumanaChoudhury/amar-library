// Polyfill Uint8Array.prototype.toHex for PDF.js v6 fingerprinting
if (!Uint8Array.prototype.toHex) {
  Uint8Array.prototype.toHex = function () {
    return Array.from(this)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
}

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from '../pdf-worker.js?worker&url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

// Individual React-controlled page item.
// React strictly manages all DOM nodes: no direct innerHTML tampering or removeChild crashes!
const PdfPageItem = memo(function PdfPageItem({
  pageNum,
  pdfDoc,
  pageAspectRatio,
  zoomPercent,
  isActive,
  initialInView = false,
  containerEl,
  registerSlot,
}) {
  const slotRef = useRef(null)
  const canvasRef = useRef(null)
  const renderTaskRef = useRef(null)
  const [inView, setInView] = useState(initialInView)
  const [rendered, setRendered] = useState(false)
  const [aspectRatio, setAspectRatio] = useState(pageAspectRatio || 1.414)

  // Register slot DOM node with parent for programmatic scrolling
  useEffect(() => {
    registerSlot(pageNum, slotRef.current)
    return () => {
      registerSlot(pageNum, null)
    }
  }, [pageNum, registerSlot])

  // Observe slot visibility relative to the stage container
  useEffect(() => {
    const slotEl = slotRef.current
    if (!slotEl || !containerEl) return

    let isSubscribed = true
    const observer = new IntersectionObserver(
      (entries) => {
        if (!isSubscribed) return
        const entry = entries[0]
        if (entry) {
          setInView(entry.isIntersecting)
        }
      },
      {
        root: containerEl,
        rootMargin: '600px 0px',
        threshold: 0.01,
      }
    )

    observer.observe(slotEl)

    return () => {
      isSubscribed = false
      try {
        observer.disconnect()
      } catch {
        /* ignore */
      }
    }
  }, [containerEl])

  // Render or clear page canvas based on visibility
  useEffect(() => {
    let cancelled = false
    const canvas = canvasRef.current

    // If out of view, free GPU memory safely
    if (!inView || !pdfDoc || !canvas) {
      if (!inView && rendered && canvas) {
        try {
          const ctx = canvas.getContext('2d')
          if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
          canvas.width = 0
          canvas.height = 0
        } catch {
          /* ignore */
        }
        setRendered(false)
      }
      return
    }

    async function renderPage() {
      // Cancel previous task on this page if still rendering
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          /* ignore */
        }
        renderTaskRef.current = null
      }

      try {
        const page = await pdfDoc.getPage(pageNum)
        if (cancelled) return

        const unscaledVp = page.getViewport({ scale: 1 })
        const ratio = unscaledVp.height / unscaledVp.width
        setAspectRatio(ratio)

        const slotWidth = slotRef.current?.clientWidth || 900
        const scale = (slotWidth / unscaledVp.width) * (zoomPercent / 100)
        const viewport = page.getViewport({ scale })

        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
        const canvasWidth = Math.floor(viewport.width * pixelRatio)
        const canvasHeight = Math.floor(viewport.height * pixelRatio)

        if (cancelled || !canvas) return

        canvas.width = canvasWidth
        canvas.height = canvasHeight
        canvas.style.width = '100%'
        canvas.style.height = 'auto'

        const ctx = canvas.getContext('2d')
        // Clean white background eliminates any black side bars
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)

        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
        ctx.imageSmoothingEnabled = true

        const task = page.render({
          canvasContext: ctx,
          viewport,
        })
        renderTaskRef.current = task

        await task.promise
        if (!cancelled) {
          setRendered(true)
        }
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`Render page ${pageNum} error:`, err)
        }
      } finally {
        renderTaskRef.current = null
      }
    }

    renderPage()

    return () => {
      cancelled = true
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel()
        } catch {
          /* ignore */
        }
        renderTaskRef.current = null
      }
    }
  }, [inView, pdfDoc, pageNum, zoomPercent, rendered])

  return (
    <div
      ref={slotRef}
      data-page-number={pageNum}
      className={`pdf-page-slot ${isActive ? 'active-slot' : ''}`}
      style={{
        aspectRatio: `1 / ${aspectRatio}`,
        minHeight: '260px',
      }}
    >
      <div className="page-slot-badge">Page {pageNum}</div>
      <canvas ref={canvasRef} className="continuous-page-canvas" />
      {!rendered && (
        <div className="page-placeholder-text">Loading page {pageNum}...</div>
      )}
    </div>
  )
})

export default function PdfReader({
  url,
  book,
  onProgressChange,
  onClose,
}) {
  const containerRef = useRef(null)
  const pdfDocRef = useRef(null)
  const loadingTaskRef = useRef(null)
  const debounceTimerRef = useRef(null)
  const pendingProgressRef = useRef(null)
  const onProgressChangeRef = useRef(onProgressChange)
  const pageSlotsRef = useRef(new Map())
  const scrollThrottleTimerRef = useRef(null)
  const isUnmountingRef = useRef(false)

  const startingPage = Math.max(1, Number(book.last_read_page) || 1)
  const initialPageRef = useRef(startingPage)
  const [containerEl, setContainerEl] = useState(null)
  const [pdfDoc, setPdfDoc] = useState(null)
  const [totalPages, setTotalPages] = useState(book.total_pages || 0)
  const [currentPage, setCurrentPage] = useState(startingPage)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fullscreen, setFullscreen] = useState(false)
  const [pageInput, setPageInput] = useState(String(startingPage))

  // Sizing mode: 'fit-width' | 'fit-page' | 'custom'
  const [fitMode, setFitMode] = useState('fit-width')
  const [zoomPercent, setZoomPercent] = useState(100)
  const [pageAspectRatio, setPageAspectRatio] = useState(1.414)

  useEffect(() => {
    onProgressChangeRef.current = onProgressChange
  }, [onProgressChange])

  // Capture container element for IntersectionObserver root once mounted
  useEffect(() => {
    if (containerRef.current) {
      setContainerEl(containerRef.current)
    }
  }, [loading])

  // Safe exit from fullscreen
  const exitFullscreenSafe = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch (err) {
        console.warn('Exit fullscreen error:', err)
      }
    }
  }, [])

  // Safe close handler: exits fullscreen first then triggers onClose
  const handleSafeClose = useCallback(async () => {
    await exitFullscreenSafe()
    if (onClose) {
      onClose()
    }
  }, [exitFullscreenSafe, onClose])

  // Flush pending progress update safely on unmount
  useEffect(() => {
    return () => {
      isUnmountingRef.current = true
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (pendingProgressRef.current && onProgressChangeRef.current) {
        try {
          const { bookId, page, total } = pendingProgressRef.current
          onProgressChangeRef.current(bookId, page, total)
        } catch (err) {
          console.warn('Could not flush progress on unmount:', err)
        }
      }
      // Ensure fullscreen is never left active when reader leaves DOM
      if (document.fullscreenElement) {
        try {
          document.exitFullscreen().catch(() => {})
        } catch {
          /* ignore */
        }
      }
    }
  }, [])

  // Load PDF Document
    
  // Load PDF progressively instead of downloading the entire file first.
  useEffect(() => {
    let cancelled = false
    let loadingTask = null
    let loadedPdf = null

    async function loadPdfDocument() {
      setLoading(true)
      setError('')
      setPdfDoc(null)
      setTotalPages(0)

      if (!url || typeof url !== 'string') {
        setError('PDF URL is missing. Close and reopen the book.')
        setLoading(false)
        return
      }

      try {
        loadingTask = pdfjsLib.getDocument({
          url,
          withCredentials: false,
        })

        loadingTaskRef.current = loadingTask

        const pdf = await loadingTask.promise

        if (cancelled) {
          await pdf.destroy()
          return
        }

        loadedPdf = pdf
        pdfDocRef.current = pdf

        // Set the document state so the page components can render.
        setPdfDoc(pdf)
        setTotalPages(pdf.numPages)

        const initialPage = Math.min(
          initialPageRef.current,
          pdf.numPages
        )

        setCurrentPage(initialPage)
        setPageInput(String(initialPage))

        try {
          const firstPage = await pdf.getPage(1)
          const viewport = firstPage.getViewport({ scale: 1 })

          if (!cancelled && viewport.width && viewport.height) {
            setPageAspectRatio(viewport.height / viewport.width)
          }
        } catch (pageError) {
          console.warn('Could not read first-page dimensions:', pageError)
        }

        if (!cancelled) {
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          console.error('PDF loading failed:', err)
          setError(
            `Could not load book: ${err.message || 'Unknown PDF error'}`
          )
          setLoading(false)
        }
      }
    }

    loadPdfDocument()

    return () => {
      cancelled = true

      if (loadingTaskRef.current === loadingTask) {
        loadingTaskRef.current = null
      }

      pdfDocRef.current = null

      if (loadingTask) {
        loadingTask.destroy().catch(() => {})
      } else if (loadedPdf) {
        loadedPdf.destroy().catch(() => {})
      }
    }
  }, [url, book.id])


  // Scroll to initial page once pages are mounted
  useEffect(() => {
    if (!loading && totalPages > 0 && initialPageRef.current > 1) {
      const target = Math.min(initialPageRef.current, totalPages)
      const timer = setTimeout(() => {
        const slot = pageSlotsRef.current.get(target)
        if (slot) {
          slot.scrollIntoView({ behavior: 'auto', block: 'start' })
        }
      }, 180)
      return () => clearTimeout(timer)
    }
  }, [loading, totalPages])

  // Debounced progress saving to Supabase
  const triggerDebouncedProgress = useCallback(
    (page, total) => {
      if (isUnmountingRef.current) return
      pendingProgressRef.current = { bookId: book.id, page, total }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        if (
          !isUnmountingRef.current &&
          pendingProgressRef.current &&
          onProgressChangeRef.current
        ) {
          const { bookId, page: p, total: t } = pendingProgressRef.current
          onProgressChangeRef.current(bookId, p, t)
          pendingProgressRef.current = null
        }
      }, 1400)
    },
    [book.id]
  )

  // Scroll directly to a specific page
  const scrollToPage = useCallback(
    (targetPage) => {
      const page = Math.max(1, Math.min(totalPages || 1, Number(targetPage) || 1))
      setCurrentPage(page)
      setPageInput(String(page))

      const slot = pageSlotsRef.current.get(page)
      if (slot) {
        slot.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }

      if (totalPages > 0) {
        triggerDebouncedProgress(page, totalPages)
      }
    },
    [totalPages, triggerDebouncedProgress]
  )

  // Slot registry callback
  const registerSlot = useCallback((pageNum, el) => {
    if (el) {
      pageSlotsRef.current.set(pageNum, el)
    } else {
      pageSlotsRef.current.delete(pageNum)
    }
  }, [])

  // Throttled scroll listener: tracks current page smoothly without freezing the UI
  const handleScroll = useCallback(() => {
    if (scrollThrottleTimerRef.current) return

    scrollThrottleTimerRef.current = setTimeout(() => {
      scrollThrottleTimerRef.current = null
      const container = containerRef.current
      if (!container || isUnmountingRef.current) return

      const containerTop = container.getBoundingClientRect().top
      let closestPage = 1
      let minDistance = Infinity

      pageSlotsRef.current.forEach((slot, pageNum) => {
        if (!slot) return
        const rect = slot.getBoundingClientRect()
        // Determine which page is closest to top viewport of reader
        const dist = Math.abs(rect.top - containerTop)
        if (dist < minDistance) {
          minDistance = dist
          closestPage = pageNum
        }
      })

      setCurrentPage((prev) => {
        if (prev !== closestPage) {
          setPageInput(String(closestPage))
          triggerDebouncedProgress(closestPage, totalPages)
          return closestPage
        }
        return prev
      })
    }, 120)
  }, [totalPages, triggerDebouncedProgress])

  // Fullscreen listener + automatic screen resize
  useEffect(() => {
    function handleFullscreenChange() {
      const isFs = Boolean(document.fullscreenElement)
      setFullscreen(isFs)
      if (isFs) {
        setFitMode('fit-width')
        setZoomPercent(100)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  async function toggleFullscreen() {
    const modalEl = containerRef.current?.closest('.pdf-reader-modal')
    try {
      if (!document.fullscreenElement && modalEl) {
        await modalEl.requestFullscreen()
      } else if (document.fullscreenElement) {
        await document.exitFullscreen()
      }
    } catch (err) {
      console.warn('Fullscreen request failed:', err)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        if (currentPage < totalPages) scrollToPage(currentPage + 1)
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault()
        if (currentPage > 1) scrollToPage(currentPage - 1)
      } else if (e.key === 'Home') {
        scrollToPage(1)
      } else if (e.key === 'End') {
        scrollToPage(totalPages)
      } else if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey) {
        toggleFullscreen()
      } else if (e.key === 'Escape') {
        handleSafeClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, totalPages, scrollToPage, handleSafeClose])

  function getPageMaxWidth() {
    if (fullscreen) return '100%'
    if (fitMode === 'fit-width') return '100%'
    if (fitMode === 'fit-page') return 'min(720px, 80vw)'
    return `${Math.round(950 * (zoomPercent / 100))}px`
  }

  const progressPercent = totalPages
    ? Math.round((currentPage / totalPages) * 100)
    : 0

  return (
    <div
      className={`pdf-reader-container continuous-mode ${fullscreen ? 'is-fullscreen' : ''}`}
    >
      {/* Top Header Bar */}
      <div className="pdf-reader-header-bar">
        <div className="pdf-book-meta">
          <span className="pdf-meta-badge">📖 READING</span>
          <h2 title={book.title}>{book.title}</h2>
          {book.author && <span className="pdf-author">by {book.author}</span>}
        </div>

        <div className="pdf-header-controls">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="pdf-action-link"
            title="Open direct cloud PDF in new tab or external viewer"
          >
            Open in Tab ↗
          </a>

          <button
            type="button"
            className="pdf-close-button"
            onClick={handleSafeClose}
            aria-label="Close reader"
          >
            Close ✕
          </button>
        </div>
      </div>

      {/* Control Toolbar: Page counter, Fit modes, Zoom, Fullscreen */}
      <div className="pdf-nav-bar">
        <div className="pdf-page-nav-group">
          <button
            type="button"
            className="pdf-nav-btn"
            onClick={() => scrollToPage(currentPage - 1)}
            disabled={currentPage <= 1 || loading}
            title="Scroll up to previous page"
          >
            ▲ Prev
          </button>

          <form
            className="pdf-page-form"
            onSubmit={(e) => {
              e.preventDefault()
              scrollToPage(pageInput)
            }}
          >
            <span>Page</span>
            <input
              type="number"
              min="1"
              max={totalPages || 1}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => scrollToPage(pageInput)}
              disabled={loading || !totalPages}
            />
            <span>of {totalPages || '…'}</span>
          </form>

          <button
            type="button"
            className="pdf-nav-btn"
            onClick={() => scrollToPage(currentPage + 1)}
            disabled={currentPage >= totalPages || loading}
            title="Scroll down to next page"
          >
            ▼ Next
          </button>
        </div>

        {/* Quick page scrubber */}
        {totalPages > 1 && (
          <div className="pdf-slider-group">
            <input
              type="range"
              min="1"
              max={totalPages}
              value={currentPage}
              onChange={(e) => scrollToPage(Number(e.target.value))}
              aria-label="Scroll to page"
              className="pdf-scrubber"
            />
            <span className="pdf-percent-pill">{progressPercent}%</span>
          </div>
        )}

        {/* Sizing & Screen Fit Controls */}
        <div className="pdf-tools-group">
          <button
            type="button"
            className={`pdf-fit-btn ${fitMode === 'fit-width' ? 'active' : ''}`}
            onClick={() => {
              setFitMode('fit-width')
              setZoomPercent(100)
            }}
            title="Fit Width: Expands PDF automatically to fill screen width"
          >
            ↔ Fit Width
          </button>

          <button
            type="button"
            className={`pdf-fit-btn ${fitMode === 'fit-page' ? 'active' : ''}`}
            onClick={() => {
              setFitMode('fit-page')
              setZoomPercent(100)
            }}
            title="Fit Screen: Fits whole page height in view"
          >
            ↕ Fit Screen
          </button>

          {/* Zoom controls */}
          <div className="pdf-zoom-group">
            <button
              type="button"
              className="pdf-icon-btn"
              onClick={() => {
                setFitMode('custom')
                setZoomPercent((z) => Math.max(50, z - 15))
              }}
              title="Zoom out"
            >
              −
            </button>
            <span className="pdf-zoom-val">{zoomPercent}%</span>
            <button
              type="button"
              className="pdf-icon-btn"
              onClick={() => {
                setFitMode('custom')
                setZoomPercent((z) => Math.min(250, z + 15))
              }}
              title="Zoom in"
            >
              +
            </button>
          </div>

          {/* Fullscreen toggle */}
          <button
            type="button"
            className="pdf-fullscreen-btn"
            onClick={toggleFullscreen}
            title={
              fullscreen
                ? 'Exit fullscreen'
                : 'Full screen (automatically scales PDF to fill screen)'
            }
          >
            {fullscreen ? '⤓ Exit Fullscreen' : '⛶ Fullscreen'}
          </button>
        </div>
      </div>

      {/* Reading Progress Line */}
      <div className="pdf-progress-indicator">
        <div
          className="pdf-progress-bar"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Main Continuous Scroll Stage (Natural 60fps Native Scrolling) */}
      <div
        ref={containerRef}
        className="pdf-continuous-scroll-stage"
        tabIndex={0}
        onScroll={handleScroll}
      >
        {loading && (
          <div className="pdf-status-card">
            <div className="pdf-spinner" />
            <p>Loading document pages...</p>
          </div>
        )}

        {error && (
          <div className="pdf-status-card error">
            <p className="error-title">Could not display book</p>
            <p>{error}</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="pdf-fallback-btn"
            >
              Open via Cloud Link ↗
            </a>
          </div>
        )}

        {/* Continuous Page Slots (Scroll Down Naturally!) */}
        {!loading && totalPages > 0 && (
          <div
            className="pdf-pages-scroll-stack"
            style={{ width: getPageMaxWidth() }}
          >
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <PdfPageItem
                key={pageNum}
                pageNum={pageNum}
                pdfDoc={pdfDoc}
                pageAspectRatio={pageAspectRatio}
                zoomPercent={zoomPercent}
                isActive={currentPage === pageNum}
                initialInView={pageNum === 1 || pageNum === currentPage}
                containerEl={containerEl}
                registerSlot={registerSlot}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom Footer Information */}
      <div className="pdf-reader-footer-bar">
        <span>Scroll down to read naturally • PageDown, Space, or Wheel</span>
        <span>{totalPages > 0 ? `Page ${currentPage} of ${totalPages}` : ''}</span>
      </div>
    </div>
  )
}
