function Navbar({ activePage, setActivePage, onSignOut }) {
  const pages = ['Home', 'Books', 'Collections', 'Favorites']

  return (
    <header className="navbar">
      <button className="brand" type="button" onClick={() => setActivePage('Home')} aria-label="Go to home">
        <span className="brand-mark" aria-hidden="true">❧</span>
        <span className="brand-name">The Book Nook</span>
      </button>

      <nav className="nav-links" aria-label="Main navigation">
        {pages.map((page) => (
          <button
            key={page}
            type="button"
            className={activePage === page ? 'nav-link active' : 'nav-link'}
            onClick={() => setActivePage(page)}
          >
            {page === 'Collections' ? 'My Shelf' : page}
          </button>
        ))}
      </nav>

      <div className="nav-tools">
        <button type="button" className="nav-tool" onClick={() => setActivePage('Books')} aria-label="Browse books">⌕</button>
        <button type="button" className="nav-tool" onClick={() => setActivePage('Favorites')} aria-label="View favorites">♡</button>
        {onSignOut && (
          <button type="button" className="nav-tool signout" onClick={onSignOut} title="Sign out" aria-label="Sign out">
            ⎋
          </button>
        )}
      </div>
    </header>
  )
}

export default Navbar
