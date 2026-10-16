import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import Navbar from './components/Navbar'
import BookCard from './components/BookCard'
import MusicPlayer from './components/MusicPlayer'
import ErrorBoundary from './components/ErrorBoundary'
import './App.css'

// Lazy load the PDF reader so it doesn't block initial page load or add weight
const PdfReader = lazy(() => import('./components/PdfReader'))

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [activePage, setActivePage] = useState('Home')
  const [search, setSearch] = useState('')

  const [books, setBooks] = useState([])
  const [booksLoading, setBooksLoading] = useState(true)
  const [booksError, setBooksError] = useState('')

  const [collections, setCollections] = useState([])
  const [collectionsLoading, setCollectionsLoading] = useState(false)
  const [collectionsError, setCollectionsError] = useState('')
  const [showAddCollection, setShowAddCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [newCollectionDescription, setNewCollectionDescription] = useState('')
  const [savingCollection, setSavingCollection] = useState(false)
  const [selectedCollectionId, setSelectedCollectionId] = useState('')
  const [selectedCollectionBookIds, setSelectedCollectionBookIds] = useState([])
  const [collectionBookToAdd, setCollectionBookToAdd] = useState('')
  const [addingCollectionBook, setAddingCollectionBook] = useState(false)

  // Add Book Form state
  const [showAddBook, setShowAddBook] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newAuthor, setNewAuthor] = useState('')
  const [newGenre, setNewGenre] = useState('Fiction')
  const [newDescription, setNewDescription] = useState('')
  const [savingBook, setSavingBook] = useState(false)
  const [pdfFile, setPdfFile] = useState(null)
  const [coverFile, setCoverFile] = useState(null)

  // Edit Book state
  const [editingBook, setEditingBook] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editGenre, setEditGenre] = useState('Fiction')
  const [editDescription, setEditDescription] = useState('')
  const [editCoverFile, setEditCoverFile] = useState(null)
  const [editPdfFile, setEditPdfFile] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // PDF Viewer state
  const [pdfUrl, setPdfUrl] = useState('')
  const [selectedPdfTitle, setSelectedPdfTitle] = useState('')
  const [openingBookId, setOpeningBookId] = useState(null)
  const [selectedPdfBook, setSelectedPdfBook] = useState(null)

  // Forgot password & OTP new password state
  const [requireNewPassword, setRequireNewPassword] = useState(false)
  const [newPasswordInput, setNewPasswordInput] = useState('')
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('')
  const [passwordModalMsg, setPasswordModalMsg] = useState('')
  const [passwordModalError, setPasswordModalError] = useState(false)
  const [updatingPassword, setUpdatingPassword] = useState(false)

  // Light / Dark Theme Mode with system preference & localStorage persistence
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('amar-library-theme')
      if (saved === 'dark' || saved === 'light') return saved
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
    } catch (err) {
      console.debug('Theme preference read error:', err)
    }
    return 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('amar-library-theme', theme)
    } catch (err) {
      console.debug('Theme preference save error:', err)
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  // In-memory cache for cover signed URLs to eliminate redundant network requests
  const coverUrlCacheRef = useRef(new Map())
  const userId = session?.user?.id

  // Restore existing login session and listen for auth changes
  useEffect(() => {
    let mounted = true

    async function loadSession() {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!mounted) return
        if (error) console.error('Could not retrieve session:', error.message)
        setSession(data?.session ?? null)
      } catch (err) {
        console.error('Session load error:', err)
      } finally {
        if (mounted) setAuthLoading(false)
      }
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession)
      setAuthLoading(false)
      if (event === 'PASSWORD_RECOVERY') {
        setRequireNewPassword(true)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Load books with cached cover URLs
  useEffect(() => {
    let cancelled = false

    async function loadBooks() {
      if (authLoading) return

      if (!userId) {
        setBooks([])
        setBooksError('')
        setBooksLoading(false)
        return
      }

      setBooksLoading(true)
      setBooksError('')

      try {
        const { data, error } = await supabase
          .from('books')
          .select('*')
          .eq('owner_id', userId)
          .order('created_at', { ascending: false })

        if (cancelled) return

        if (error) {
          setBooksError(error.message)
          setBooks([])
          setBooksLoading(false)
          return
        }

        const now = Date.now()
        const booksWithCovers = await Promise.all(
          (data ?? []).map(async (book) => {
            if (!book.cover_path) return { ...book, coverUrl: '' }

            const cached = coverUrlCacheRef.current.get(book.cover_path)
            if (cached && cached.expiresAt > now + 300000) {
              return { ...book, coverUrl: cached.url }
            }

            try {
              const { data: coverData, error: coverError } = await supabase.storage
                .from('book-covers')
                .createSignedUrl(book.cover_path, 3600)

              if (coverError || !coverData?.signedUrl) {
                return { ...book, coverUrl: '' }
              }

              coverUrlCacheRef.current.set(book.cover_path, {
                url: coverData.signedUrl,
                expiresAt: now + 3500000,
              })

              return { ...book, coverUrl: coverData.signedUrl }
            } catch {
              return { ...book, coverUrl: '' }
            }
          })
        )

        if (cancelled) return
        setBooks(booksWithCovers)
      } catch (err) {
        if (!cancelled) setBooksError(`Failed to load books: ${err.message}`)
      } finally {
        if (!cancelled) setBooksLoading(false)
      }
    }

    loadBooks()

    return () => {
      cancelled = true
    }
  }, [userId, authLoading])

  // Load signed-in user's collections
  useEffect(() => {
    let cancelled = false

    async function loadCollections() {
      if (authLoading) return

      if (!userId) {
        setCollections([])
        setSelectedCollectionId('')
        setSelectedCollectionBookIds([])
        setCollectionsLoading(false)
        return
      }

      setCollectionsLoading(true)
      setCollectionsError('')

      try {
        const { data, error } = await supabase
          .from('collections')
          .select('*')
          .eq('owner_id', userId)
          .order('created_at', { ascending: false })

        if (cancelled) return

        if (error) {
          setCollections([])
          setCollectionsError(`Could not load collections: ${error.message}`)
        } else {
          setCollections(data ?? [])
        }
      } catch (err) {
        if (!cancelled) setCollectionsError(err.message)
      } finally {
        if (!cancelled) setCollectionsLoading(false)
      }
    }

    loadCollections()

    return () => {
      cancelled = true
    }
  }, [userId, authLoading])

  // Load book IDs belonging to currently selected collection
  useEffect(() => {
    let cancelled = false

    async function loadCollectionBooks() {
      if (!userId || !selectedCollectionId) {
        setSelectedCollectionBookIds([])
        return
      }

      try {
        const { data, error } = await supabase
          .from('collection_books')
          .select('book_id')
          .eq('collection_id', selectedCollectionId)
          .eq('owner_id', userId)

        if (cancelled) return

        if (error) {
          setCollectionsError(`Could not load books in collection: ${error.message}`)
          setSelectedCollectionBookIds([])
          return
        }

        setSelectedCollectionBookIds((data ?? []).map((row) => row.book_id))
      } catch (err) {
        if (!cancelled) setCollectionsError(err.message)
      }
    }

    loadCollectionBooks()

    return () => {
      cancelled = true
    }
  }, [userId, selectedCollectionId])

  // Add Book submission
  const handleAddBook = async (event) => {
    event.preventDefault()

    if (!userId) {
      setBooksError('Please sign in before adding a book.')
      return
    }

    if (!newTitle.trim()) {
      setBooksError('Please enter a book title.')
      return
    }

    if (pdfFile) {
      if (
        pdfFile.type !== 'application/pdf' ||
        pdfFile.size > 60 * 1024 * 1024
      ) {
        setBooksError('Please choose a valid PDF file smaller than 60 MB.')
        return
      }
    }

    if (coverFile) {
      const allowedCoverTypes = ['image/jpeg', 'image/png', 'image/webp']
      if (
        !allowedCoverTypes.includes(coverFile.type) ||
        coverFile.size > 8 * 1024 * 1024
      ) {
        setBooksError('Choose a JPG, PNG, or WebP cover image smaller than 8 MB.')
        return
      }
    }

    setSavingBook(true)
    setBooksError('')

    let createdBook = null
    let uploadedPdfPath = null
    let uploadedCoverPath = null
    let bookSuccessfullyAdded = false

    try {
      const { data: book, error: insertError } = await supabase
        .from('books')
        .insert({
          owner_id: userId,
          title: newTitle.trim(),
          author: newAuthor.trim(),
          genre: newGenre.trim(),
          description: newDescription.trim(),
        })
        .select()
        .single()

      if (insertError) throw insertError
      createdBook = book

      if (pdfFile) {
        const safePdfName = pdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        uploadedPdfPath = `${userId}/${book.id}/${safePdfName}`

        const { error: pdfError } = await supabase.storage
          .from('book-pdfs')
          .upload(uploadedPdfPath, pdfFile, {
            contentType: 'application/pdf',
            upsert: true,
          })

        if (pdfError) throw pdfError
      }

      if (coverFile) {
        const safeCoverName = coverFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        uploadedCoverPath = `${userId}/${book.id}/${safeCoverName}`

        const { error: coverError } = await supabase.storage
          .from('book-covers')
          .upload(uploadedCoverPath, coverFile, {
            contentType: coverFile.type,
            upsert: true,
          })

        if (coverError) throw coverError
      }

      const { data: updatedBook, error: updateError } = await supabase
        .from('books')
        .update({
          pdf_path: uploadedPdfPath,
          cover_path: uploadedCoverPath,
        })
        .eq('id', book.id)
        .eq('owner_id', userId)
        .select()
        .single()

      if (updateError) throw updateError

      let coverUrl = ''
      if (updatedBook.cover_path) {
        const { data: coverData } = await supabase.storage
          .from('book-covers')
          .createSignedUrl(updatedBook.cover_path, 3600)

        if (coverData?.signedUrl) {
          coverUrl = coverData.signedUrl
          coverUrlCacheRef.current.set(updatedBook.cover_path, {
            url: coverUrl,
            expiresAt: Date.now() + 3500000,
          })
        }
      }

      setBooks((current) => [{ ...updatedBook, coverUrl }, ...current])
      bookSuccessfullyAdded = true
      setNewTitle('')
      setNewAuthor('')
      setNewGenre('Fiction')
      setNewDescription('')
      setPdfFile(null)
      setCoverFile(null)
      setShowAddBook(false)
    } catch (error) {
      if (bookSuccessfullyAdded) {
        console.warn('Non-fatal error after book addition:', error)
        return
      }
      console.error('Error adding book:', error)
      if (uploadedPdfPath) {
        try {
          await supabase.storage.from('book-pdfs').remove([uploadedPdfPath])
        } catch (cleanupErr) {
          console.warn('PDF cleanup error:', cleanupErr)
        }
      }
      if (uploadedCoverPath) {
        try {
          await supabase.storage.from('book-covers').remove([uploadedCoverPath])
        } catch (cleanupErr) {
          console.warn('Cover cleanup error:', cleanupErr)
        }
      }
      if (createdBook) {
        try {
          await supabase.from('books').delete().eq('id', createdBook.id)
        } catch (cleanupErr) {
          console.warn('Book cleanup error:', cleanupErr)
        }
      }
      let userMsg = error?.message || 'Could not save the book. Check connection.'
      if (userMsg.includes('Failed to fetch') || error?.name === 'TypeError') {
        userMsg =
          'Upload failed: The "book-pdfs" storage bucket is missing in Supabase or network connection timed out. Please run the setup SQL in your Supabase dashboard.'
      } else if (userMsg.includes('Bucket not found') || error?.code === 'NoSuchBucket') {
        userMsg =
          'Storage bucket not found: Please create the "book-pdfs" and "book-covers" buckets in your Supabase Dashboard.'
      }
      setBooksError(userMsg)
    } finally {
      setSavingBook(false)
    }
  }

  // Open Edit Book modal
  const handleOpenEditBook = useCallback((book) => {
    setEditingBook(book)
    setEditTitle(book.title || '')
    setEditAuthor(book.author || '')
    setEditGenre(book.genre || 'Fiction')
    setEditDescription(book.description || '')
    setEditCoverFile(null)
    setEditPdfFile(null)
  }, [])

  // Save Book Edit
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!userId || !editingBook) return

    setSavingEdit(true)
    setBooksError('')

    let uploadedCoverPath = editingBook.cover_path
    let uploadedPdfPath = editingBook.pdf_path
    let newCoverUrl = editingBook.coverUrl

    try {
      if (editCoverFile) {
        const safeCoverName = editCoverFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        uploadedCoverPath = `${userId}/${editingBook.id}/${Date.now()}_${safeCoverName}`

        const { error: coverErr } = await supabase.storage
          .from('book-covers')
          .upload(uploadedCoverPath, editCoverFile, {
            contentType: editCoverFile.type,
            upsert: true,
          })
        if (coverErr) throw coverErr

        const { data: cData } = await supabase.storage
          .from('book-covers')
          .createSignedUrl(uploadedCoverPath, 3600)

        if (cData?.signedUrl) {
          newCoverUrl = cData.signedUrl
          coverUrlCacheRef.current.set(uploadedCoverPath, {
            url: newCoverUrl,
            expiresAt: Date.now() + 3500000,
          })
        }
      }

      if (editPdfFile) {
        const safePdfName = editPdfFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        uploadedPdfPath = `${userId}/${editingBook.id}/${Date.now()}_${safePdfName}`

        const { error: pdfErr } = await supabase.storage
          .from('book-pdfs')
          .upload(uploadedPdfPath, editPdfFile, {
            contentType: 'application/pdf',
            upsert: true,
          })
        if (pdfErr) throw pdfErr
      }

      const updates = {
        title: editTitle.trim(),
        author: editAuthor.trim(),
        genre: editGenre.trim(),
        description: editDescription.trim(),
        cover_path: uploadedCoverPath,
        pdf_path: uploadedPdfPath,
      }

      const { data: updated, error: updateErr } = await supabase
        .from('books')
        .update(updates)
        .eq('id', editingBook.id)
        .eq('owner_id', userId)
        .select()
        .single()

      if (updateErr) throw updateErr

      setBooks((current) =>
        current.map((b) =>
          b.id === editingBook.id
            ? { ...b, ...updated, coverUrl: newCoverUrl }
            : b
        )
      )

      setEditingBook(null)
    } catch (err) {
      console.error('Failed to update book:', err)
      let editMsg = err?.message || 'Update failed'
      if (editMsg.includes('Failed to fetch') || err?.name === 'TypeError') {
        editMsg = 'Connection timed out or Supabase storage buckets need to be created.'
      }
      setBooksError(`Could not update book: ${editMsg}`)
    } finally {
      setSavingEdit(false)
    }
  }

  // Delete Book handler
  const handleDeleteBook = useCallback(
    async (bookId, bookTitle) => {
      if (!userId) return

      const confirmed = window.confirm(
        `Are you sure you want to remove "${bookTitle}" from your bookshelf?`
      )
      if (!confirmed) return

      const bookToDelete = books.find((b) => b.id === bookId)

      // Optimistically remove from state
      setBooks((current) => current.filter((b) => b.id !== bookId))

      try {
        const { error } = await supabase
          .from('books')
          .delete()
          .eq('id', bookId)
          .eq('owner_id', userId)

        if (error) throw error

        if (bookToDelete?.pdf_path) {
          try {
            await supabase.storage.from('book-pdfs').remove([bookToDelete.pdf_path])
          } catch (storageErr) {
            console.warn('Storage cleanup error:', storageErr)
          }
        }
        if (bookToDelete?.cover_path) {
          try {
            await supabase.storage.from('book-covers').remove([bookToDelete.cover_path])
          } catch (storageErr) {
            console.warn('Cover storage cleanup error:', storageErr)
          }
        }

        try {
          await supabase.from('collection_books').delete().eq('book_id', bookId)
        } catch (colErr) {
          console.warn('Collection book cleanup error:', colErr)
        }
      } catch (err) {
        console.error('Failed to delete book:', err)
        setBooksError(`Could not delete "${bookTitle}": ${err.message}`)
        if (bookToDelete) {
          setBooks((current) => [bookToDelete, ...current])
        }
      }
    },
    [userId, books]
  )

  // Open PDF handler
  const handleOpenPdf = useCallback(
    async (book, mode = 'web') => {
      if (!book.pdf_path) {
        setBooksError('This book does not have a PDF uploaded.')
        return
      }

      setOpeningBookId(book.id)
      setBooksError('')

      try {
        const { data, error } = await supabase.storage
          .from('book-pdfs')
          .createSignedUrl(book.pdf_path, 7200)

        if (error || !data?.signedUrl) {
          setBooksError(`Could not generate PDF link: ${error?.message || 'Link failed.'}`)
          return
        }

        const signedUrl = data.signedUrl

        if (mode === 'cloud') {
          window.open(signedUrl, '_blank', 'noopener,noreferrer')
        } else {
          setSelectedPdfTitle(book.title)
          setSelectedPdfBook(book)
          setPdfUrl(signedUrl)
        }
      } catch (error) {
        setBooksError(`Could not open PDF: ${error.message}`)
      } finally {
        setOpeningBookId(null)
      }
    },
    []
  )

  const handleClosePdf = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch (err) {
        console.warn('Exit fullscreen error:', err)
      }
    }
    setPdfUrl('')
    setSelectedPdfTitle('')
    setSelectedPdfBook(null)
  }, [])

  // Toggle favorite
  const toggleFavorite = useCallback(
    async (bookId) => {
      setBooks((current) =>
        current.map((item) =>
          item.id === bookId ? { ...item, is_favorite: !item.is_favorite } : item
        )
      )

      const book = books.find((b) => b.id === bookId)
      if (!book || !userId) return

      const nextFav = !book.is_favorite
      const { error } = await supabase
        .from('books')
        .update({ is_favorite: nextFav })
        .eq('id', bookId)
        .eq('owner_id', userId)

      if (error) {
        setBooks((current) =>
          current.map((item) =>
            item.id === bookId ? { ...item, is_favorite: !nextFav } : item
          )
        )
        setBooksError(`Could not update favorite: ${error.message}`)
      }
    },
    [books, userId]
  )

  // Manual bookmark update
  const handleManualBookmark = useCallback(
    async (bookId, pageValue) => {
      if (!userId) return

      const page = Math.max(1, Math.floor(Number(pageValue) || 1))
      const book = books.find((item) => item.id === bookId)
      if (!book) return

      const totalPages = Number(book.total_pages) || 0
      const progress = totalPages
        ? Math.min(100, Math.round((page / totalPages) * 100))
        : Number(book.reading_progress) || 0

      const updates = {
        last_read_page: page,
        ...(totalPages ? { reading_progress: progress } : {}),
      }

      setBooks((current) =>
        current.map((item) =>
          item.id === bookId ? { ...item, ...updates } : item
        )
      )

      const { error } = await supabase
        .from('books')
        .update(updates)
        .eq('id', bookId)
        .eq('owner_id', userId)

      if (error) {
        setBooksError(`Could not save bookmark: ${error.message}`)
      }
    },
    [books, userId]
  )

  // Debounced progress callback received from PdfReader
  const handleReaderProgress = useCallback(
    async (bookId, currentPage, totalPages) => {
      if (!userId || !totalPages) return

      const progress = Math.min(100, Math.round((currentPage / totalPages) * 100))

      setBooks((current) =>
        current.map((b) =>
          b.id === bookId
            ? {
                ...b,
                last_read_page: currentPage,
                total_pages: totalPages,
                reading_progress: progress,
              }
            : b
        )
      )

      try {
        await supabase
          .from('books')
          .update({
            last_read_page: currentPage,
            total_pages: totalPages,
            reading_progress: progress,
          })
          .eq('id', bookId)
          .eq('owner_id', userId)
      } catch (err) {
        console.error('Could not save progress:', err)
      }
    },
    [userId]
  )

  // Collection management
  const handleCreateCollection = async (event) => {
    event.preventDefault()
    const name = newCollectionName.trim()
    if (!userId || !name) return

    setSavingCollection(true)
    setCollectionsError('')

    const { data, error } = await supabase
      .from('collections')
      .insert({
        owner_id: userId,
        name,
        description: newCollectionDescription.trim() || null,
      })
      .select()
      .single()

    if (error) {
      setCollectionsError(
        error.code === '23505'
          ? 'You already have a collection with that name.'
          : `Could not create collection: ${error.message}`
      )
    } else {
      setCollections((current) => [data, ...current])
      setSelectedCollectionId(data.id)
      setNewCollectionName('')
      setNewCollectionDescription('')
      setShowAddCollection(false)
    }

    setSavingCollection(false)
  }

  const handleAddBookToCollection = async (event) => {
    event.preventDefault()
    if (!userId || !selectedCollectionId || !collectionBookToAdd) return
    if (selectedCollectionBookIds.includes(collectionBookToAdd)) return

    setAddingCollectionBook(true)
    setCollectionsError('')

    const { error } = await supabase.from('collection_books').insert({
      collection_id: selectedCollectionId,
      book_id: collectionBookToAdd,
      owner_id: userId,
    })

    if (error) {
      setCollectionsError(`Could not add book to collection: ${error.message}`)
    } else {
      setSelectedCollectionBookIds((curr) => [...curr, collectionBookToAdd])
      setCollectionBookToAdd('')
    }

    setAddingCollectionBook(false)
  }

  const handleRemoveBookFromCollection = async (bookId) => {
    if (!userId || !selectedCollectionId) return

    const { error } = await supabase
      .from('collection_books')
      .delete()
      .eq('collection_id', selectedCollectionId)
      .eq('book_id', bookId)
      .eq('owner_id', userId)

    if (error) {
      setCollectionsError(`Could not remove book: ${error.message}`)
    } else {
      setSelectedCollectionBookIds((curr) => curr.filter((id) => id !== bookId))
    }
  }

  const handleDeleteCollection = async (collectionId) => {
    if (!userId) return

    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId)
      .eq('owner_id', userId)

    if (error) {
      setCollectionsError(`Could not delete collection: ${error.message}`)
      return
    }

    setCollections((curr) => curr.filter((c) => c.id !== collectionId))
    if (selectedCollectionId === collectionId) {
      setSelectedCollectionId('')
      setSelectedCollectionBookIds([])
    }
  }

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) setBooksError(`Sign out failed: ${error.message}`)
  }

  // Memoized search filtering
  const filteredBooks = useMemo(() => {
    const query = search.trim().toLowerCase()
    return books.filter((book) => {
      const matchesSearch =
        !query ||
        (book.title ?? '').toLowerCase().includes(query) ||
        (book.author ?? '').toLowerCase().includes(query) ||
        (book.genre ?? '').toLowerCase().includes(query)

      if (activePage === 'Favorites') {
        return matchesSearch && book.is_favorite
      }
      return matchesSearch
    })
  }, [books, search, activePage])

  async function handleModalUpdatePassword(event) {
    event.preventDefault()
    setPasswordModalMsg('')
    setPasswordModalError(false)

    if (newPasswordInput.length < 6) {
      setPasswordModalMsg('Password must be at least 6 characters long.')
      setPasswordModalError(true)
      return
    }

    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordModalMsg('Passwords do not match. Please re-enter.')
      setPasswordModalError(true)
      return
    }

    setUpdatingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPasswordInput,
      })
      if (error) throw error
      setPasswordModalMsg('Password updated successfully! Welcome to Amar Library.')
      setTimeout(() => {
        setRequireNewPassword(false)
        setNewPasswordInput('')
        setConfirmPasswordInput('')
        setPasswordModalMsg('')
      }, 1200)
    } catch (err) {
      setPasswordModalError(true)
      setPasswordModalMsg(err.message || 'Could not update password. Please try again.')
    } finally {
      setUpdatingPassword(false)
    }
  }

  if (authLoading) {
    return (
      <div className="loading-screen">
        <p className="loading-message">Opening Amar Library...</p>
      </div>
    )
  }

  if (!session) {
    return <Auth onOtpVerified={() => setRequireNewPassword(true)} />
  }

  return (
    <div className="app">
      <Navbar
        activePage={activePage}
        setActivePage={setActivePage}
        onSignOut={handleSignOut}
        theme={theme}
        toggleTheme={toggleTheme}
      />

      <main>
        {/* Aesthetic Welcome Hero */}
        {activePage === 'Home' && (
          <section className="welcome-section" id="home">
            <div className="hero-copy">
              <p className="hero-kicker">Good books. Cozy corners. Happier days.</p>
              <h1>A Library for<br />Dreamers &amp; Readers</h1>
              <p className="welcome-subtext">
                Explore a world of stories, one book at a time.<br />
                Find your next favourite, build your shelf,<br className="desktop-break" />
                and make this space your own.
              </p>
              <form className="hero-search" onSubmit={(event) => { event.preventDefault(); setActivePage('Books') }}>
                <span aria-hidden="true">⌕</span>
                <input
                  aria-label="Search books"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search for books, authors, genres..."
                />
                <button type="submit" aria-label="Search">→</button>
              </form>
            </div>
            <div className="hero-bottom-note" aria-hidden="true">A cozy sanctuary for your next great adventure</div>
          </section>
        )}

        {/* Bookshelf & Collections Section */}
        {activePage !== 'About' && (
        <section className="books-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR COLLECTION</p>
              <h2>
                {activePage === 'Favorites'
                  ? 'Books You Love'
                  : activePage === 'Collections'
                    ? 'Your Shelves & Collections'
                    : activePage === 'Books'
                      ? 'All Your Stories'
                      : 'Wander Through The Shelves'}
              </h2>
            </div>

            <button
              type="button"
              className="add-book-trigger-btn"
              onClick={() => setShowAddBook((v) => !v)}
            >
              {showAddBook ? 'Cancel' : '+ Add Book'}
            </button>
          </div>

          {/* Add Book Form */}
          {showAddBook && (
            <form onSubmit={handleAddBook} className="add-book-form">
              <div className="form-header">
                <h3>Add a book to your shelf</h3>
                <p>Upload a PDF to read on the site or in your default reader app.</p>
              </div>

              <div className="form-grid">
                <label htmlFor="book-title">
                  <span>Book title *</span>
                  <input
                    id="book-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    maxLength={200}
                    placeholder="e.g. The Secret History"
                    required
                  />
                </label>

                <label htmlFor="book-author">
                  <span>Author</span>
                  <input
                    id="book-author"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    maxLength={200}
                    placeholder="Who wrote it?"
                  />
                </label>
              </div>

              <div className="form-grid">
                <label htmlFor="book-genre">
                  <span>Genre</span>
                  <select
                    id="book-genre"
                    value={newGenre}
                    onChange={(e) => setNewGenre(e.target.value)}
                  >
                    <option>Fiction</option>
                    <option>Classic</option>
                    <option>Romance</option>
                    <option>Fantasy</option>
                    <option>Mystery / Thriller</option>
                    <option>Non-fiction</option>
                    <option>Poetry</option>
                    <option>Sci-Fi</option>
                    <option>Other</option>
                  </select>
                </label>

                <label htmlFor="book-description">
                  <span>Short description</span>
                  <input
                    id="book-description"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    maxLength={500}
                    placeholder="A cozy sentence about this book..."
                  />
                </label>
              </div>

              <div className="form-files-grid">
                <label className="file-field">
                  <span>Book PDF (Read in Web or Default App)</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                  />
                  <small>
                    {pdfFile ? `✓ ${pdfFile.name}` : 'Select a PDF (up to 60 MB)'}
                  </small>
                </label>

                <label className="file-field">
                  <span>Cover image (Optional)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                  />
                  <small>
                    {coverFile ? `✓ ${coverFile.name}` : 'JPG, PNG or WebP cover'}
                  </small>
                </label>
              </div>

              <div className="form-submit-row">
                <button type="submit" className="save-book-btn" disabled={savingBook}>
                  {savingBook ? 'Uploading to cloud...' : 'Place on Bookshelf'}
                </button>
              </div>
            </form>
          )}

          {booksError && (
            <div className="books-error" role="alert">
              <span className="error-mark">!</span>
              <p>{booksError}</p>
            </div>
          )}

          {/* Search bar */}
          {activePage !== 'Collections' && (
            <div className="search-wrap">
              <span className="search-icon" aria-hidden="true">⌕</span>
              <input
                type="search"
                className="books-search-input"
                placeholder="Search titles, authors, or genres..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search books"
              />
              {search && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => setSearch('')}
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Collections view */}
          {activePage === 'Collections' ? (
            <div className="collections-area">
              <div className="collections-toolbar">
                <p>Curate themed shelves for your books.</p>
                <button
                  type="button"
                  className="new-col-btn"
                  onClick={() => setShowAddCollection((v) => !v)}
                >
                  {showAddCollection ? 'Cancel' : '+ New Collection'}
                </button>
              </div>

              {collectionsError && (
                <div className="books-error" role="alert">{collectionsError}</div>
              )}

              {showAddCollection && (
                <form onSubmit={handleCreateCollection} className="add-book-form">
                  <h3>Create a new shelf</h3>
                  <label htmlFor="collection-name">Shelf name *</label>
                  <input
                    id="collection-name"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    maxLength={100}
                    placeholder="e.g. Rainy Day Comfort Reads"
                    required
                  />
                  <label htmlFor="collection-description">Description</label>
                  <input
                    id="collection-description"
                    value={newCollectionDescription}
                    onChange={(e) => setNewCollectionDescription(e.target.value)}
                    maxLength={200}
                    placeholder="What belongs on this shelf?"
                  />
                  <button type="submit" disabled={savingCollection}>
                    {savingCollection ? 'Creating...' : 'Create Shelf'}
                  </button>
                </form>
              )}

              {collectionsLoading ? (
                <p className="loading-message">Gathering your collections...</p>
              ) : collections.length === 0 ? (
                <div className="empty-state">
                  <h3>No collections yet</h3>
                  <p>Organize your books into cozy shelves like "Favorites", "To Read", or "Classics".</p>
                </div>
              ) : (
                <div className="collections-layout">
                  <div className="collection-list">
                    {collections.map((col) => (
                      <div
                        className={`collection-item ${
                          selectedCollectionId === col.id ? 'selected' : ''
                        }`}
                        key={col.id}
                      >
                        <button
                          type="button"
                          className="collection-select-button"
                          onClick={() => setSelectedCollectionId(col.id)}
                        >
                          <span>
                            <strong>{col.name}</strong>
                            {col.description && <small>{col.description}</small>}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="collection-delete-button"
                          aria-label={`Delete ${col.name}`}
                          onClick={() => {
                            if (window.confirm(`Delete collection "${col.name}"? Books will remain safe.`)) {
                              handleDeleteCollection(col.id)
                            }
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="collection-details">
                    {!selectedCollectionId ? (
                      <div className="empty-state">
                        <h3>Select a shelf</h3>
                        <p>Click any collection on the left to view and arrange its books.</p>
                      </div>
                    ) : (
                      <>
                        <h3>{collections.find((c) => c.id === selectedCollectionId)?.name}</h3>
                        <form onSubmit={handleAddBookToCollection} className="collection-add-book">
                          <label htmlFor="col-book-select">Add a book to this shelf:</label>
                          <div className="col-add-row">
                            <select
                              id="col-book-select"
                              value={collectionBookToAdd}
                              onChange={(e) => setCollectionBookToAdd(e.target.value)}
                            >
                              <option value="">Select a book...</option>
                              {books
                                .filter((b) => !selectedCollectionBookIds.includes(b.id))
                                .map((b) => (
                                  <option value={b.id} key={b.id}>
                                    {b.title}
                                  </option>
                                ))}
                            </select>
                            <button
                              type="submit"
                              disabled={!collectionBookToAdd || addingCollectionBook}
                            >
                              {addingCollectionBook ? 'Adding...' : 'Add'}
                            </button>
                          </div>
                        </form>

                        {booksLoading ? (
                          <p className="loading-message">Loading books...</p>
                        ) : books.filter((b) => selectedCollectionBookIds.includes(b.id)).length ? (
                          <div className="collection-book-list">
                            {books
                              .filter((b) => selectedCollectionBookIds.includes(b.id))
                              .map((book) => (
                                <div className="collection-book-row" key={book.id}>
                                  <div>
                                    <strong>{book.title}</strong>
                                    <small>{book.author || 'Unknown author'}</small>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBookFromCollection(book.id)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                          </div>
                        ) : (
                          <p className="collection-empty-note">
                            This shelf is empty. Choose a book above to add it!
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : booksLoading ? (
            <p className="loading-message">Gathering your books from the cloud...</p>
          ) : filteredBooks.length > 0 ? (
            /* Aesthetic Book Grid with Edit, Delete, and Double-Click triggers */
            <div className="books-grid">
              {filteredBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  isFavorite={Boolean(book.is_favorite)}
                  onToggleFavorite={toggleFavorite}
                  onOpenPdf={handleOpenPdf}
                  isOpening={openingBookId === book.id}
                  onManualBookmark={handleManualBookmark}
                  onEdit={handleOpenEditBook}
                  onDelete={handleDeleteBook}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>
                {activePage === 'Favorites'
                  ? 'No favorites saved yet'
                  : search.trim()
                    ? 'No books match your search'
                    : 'Your bookshelf is waiting'}
              </h3>
              <p>
                {activePage === 'Favorites'
                  ? 'Tap the heart on any book to keep it close.'
                  : search.trim()
                    ? 'Try searching by title, author, or genre.'
                    : 'Upload your first book PDF and make this reading space yours.'}
              </p>
              {!search.trim() && activePage !== 'Favorites' && (
                <button
                  type="button"
                  className="primary-action-btn"
                  onClick={() => setShowAddBook(true)}
                >
                  + Add your first book
                </button>
              )}
            </div>
          )}
        </section>
        )}

        {/* About Sumana & Amar Library Section — Only shown on About page */}
        {activePage === 'About' && (
          <section className="about-me-section about-page-view" id="about">
            <div className="about-me-card">
              <div className="about-me-header">
                <div className="about-avatar-wrap">
                  <div className="about-avatar-circle" aria-hidden="true">
                    <span className="about-initials">SC</span>
                  </div>
                  <span className="about-status-pill">Creator &amp; Reader</span>
                </div>
                <div className="about-title-group">
                  <p className="eyebrow">MEET THE CREATOR</p>
                  <h2>Sumana Choudhury</h2>
                  <p className="about-tagline">The story behind Amar Library.</p>
                </div>
              </div>

              <div className="about-me-content single-column">
                <div className="about-narrative">
                  <p className="about-lead">
                    Hi, I’m <strong>Sumana Choudhury</strong> — a passionate reader who can easily get lost in 
                    fictional worlds for hours, but also an undeniably <em>clumsy</em> human being.
                  </p>
                  <p>
                    Between dropping heavy books, constantly misplacing bookmarks in every corner of the house, 
                    accidentally creasing lovely page corners, or losing track of which page I was on, 
                    reading physical books was starting to feel like a high-stakes sport!
                  </p>
                  <p>
                    That’s why I created <strong>Amar Library</strong> (<em>&ldquo;Amar&rdquo;</em> means <em>&ldquo;My&rdquo;</em> in Bengali) — 
                    my personal, fail-safe digital sanctuary. I built this space to make reading completely effortless: 
                    smooth continuous vertical scrolling, automatic full-screen page resizing that fits any device, 
                    instant cloud progress that never forgets my page, ambient sounds, and an aesthetic bookshelf I can 
                    take with me anywhere — whether on my laptop at my desk or tucked into bed on my phone.
                  </p>
                </div>
              </div>

              <div className="about-actions">
                <button
                  type="button"
                  className="primary-action-btn"
                  onClick={() => setActivePage('Books')}
                >
                  Explore My Bookshelf
                </button>
                <button
                  type="button"
                  className="secondary-action-btn"
                  onClick={() => {
                    setActivePage('Books')
                    setShowAddBook(true)
                  }}
                >
                  + Add a Book
                </button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Aesthetic Library Footer */}
      <footer className="library-footer">
        <div className="footer-container">
          <p className="footer-made-by">
            Made with love by <strong>Sumana Choudhury</strong>
          </p>
          <p className="footer-wishes">Enjoy reading your favourite stories &amp; cozy adventures!</p>
          <p className="footer-copyright">
            &copy; {new Date().getFullYear()} Amar Library. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Set New Password Modal after OTP login or password recovery */}
      {requireNewPassword && session && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Set new password">
          <div className="edit-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3>Create Your New Password</h3>
              </div>
              <button
                type="button"
                className="close-modal-icon"
                onClick={() => setRequireNewPassword(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <p className="auth-subtitle" style={{ margin: '8px 0 18px', color: '#686d5e' }}>
              Welcome back! You logged in with your verification code. Please choose a new password for future sign-ins.
            </p>

            <form onSubmit={handleModalUpdatePassword} className="auth-form">
              <label htmlFor="modal-new-password">
                <span>New password (min 6 characters) *</span>
                <input
                  id="modal-new-password"
                  type="password"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                  autoFocus
                />
              </label>

              <label htmlFor="modal-confirm-password">
                <span>Confirm new password *</span>
                <input
                  id="modal-confirm-password"
                  type="password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Repeat your new password"
                  minLength={6}
                  required
                />
              </label>

              {passwordModalMsg && (
                <div className={`auth-feedback ${passwordModalError ? 'error' : 'success'}`}>
                  {passwordModalMsg}
                </div>
              )}

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="secondary-action-btn"
                  onClick={() => setRequireNewPassword(false)}
                >
                  Skip for now
                </button>
                <button
                  type="submit"
                  className="primary-action-btn"
                  disabled={updatingPassword}
                >
                  {updatingPassword ? 'Saving...' : 'Save New Password & Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Book Modal */}
      {editingBook && (
        <div className="modal-backdrop" onClick={() => setEditingBook(null)}>
          <div className="edit-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Book Details</h3>
              <button
                type="button"
                className="close-modal-icon"
                onClick={() => setEditingBook(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="edit-book-form">
              <label htmlFor="edit-title">
                <span>Title *</span>
                <input
                  id="edit-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={200}
                  required
                />
              </label>

              <label htmlFor="edit-author">
                <span>Author</span>
                <input
                  id="edit-author"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  maxLength={200}
                />
              </label>

              <label htmlFor="edit-genre">
                <span>Genre</span>
                <select
                  id="edit-genre"
                  value={editGenre}
                  onChange={(e) => setEditGenre(e.target.value)}
                >
                  <option>Fiction</option>
                  <option>Classic</option>
                  <option>Romance</option>
                  <option>Fantasy</option>
                  <option>Mystery / Thriller</option>
                  <option>Non-fiction</option>
                  <option>Poetry</option>
                  <option>Sci-Fi</option>
                  <option>Other</option>
                </select>
              </label>

              <label htmlFor="edit-description">
                <span>Description</span>
                <input
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  maxLength={500}
                />
              </label>

              <div className="form-files-grid">
                <label className="file-field">
                  <span>Replace Cover (Optional)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setEditCoverFile(e.target.files?.[0] ?? null)}
                  />
                  <small>{editCoverFile ? `✓ ${editCoverFile.name}` : 'Keep existing cover'}</small>
                </label>

                <label className="file-field">
                  <span>Replace PDF (Optional)</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setEditPdfFile(e.target.files?.[0] ?? null)}
                  />
                  <small>{editPdfFile ? `✓ ${editPdfFile.name}` : 'Keep existing PDF'}</small>
                </label>
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="secondary-action-btn"
                  onClick={() => setEditingBook(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-action-btn" disabled={savingEdit}>
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Aesthetic Cozy Music Player */}
      <MusicPlayer />

      {/* Fullscreen & Continuous Scroll PDF Reader Modal */}
      {pdfUrl && selectedPdfBook && (
        <div
          className="pdf-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`PDF reader: ${selectedPdfTitle}`}
        >
          <div className="pdf-reader-modal">
            <ErrorBoundary
              onReset={handleClosePdf}
              fallback={(reset) => (
                <div className="pdf-reader-suspense" style={{ padding: '40px', textAlign: 'center' }}>
                  <p>Reader encountered an issue displaying the document.</p>
                  <button
                    type="button"
                    className="primary-action-btn"
                    onClick={reset}
                    style={{ marginTop: '16px' }}
                  >
                    Close Reader & Return to Bookshelf
                  </button>
                </div>
              )}
            >
              <Suspense
                fallback={
                  <div className="pdf-reader-suspense">
                    <p>Opening {selectedPdfTitle}...</p>
                  </div>
                }
              >
                <PdfReader
                  key={selectedPdfBook.id}
                  url={pdfUrl}
                  book={selectedPdfBook}
                  onProgressChange={handleReaderProgress}
                  onClose={handleClosePdf}
                />
              </Suspense>
            </ErrorBoundary>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
