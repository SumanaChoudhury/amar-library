function Navbar({ activePage, setActivePage, onSignOut, theme = 'light', toggleTheme }) {
  const pages = ['Home', 'Books', 'Collections', 'Favorites', 'About']

  return (
    <header className="navbar">
      <button className="brand" type="button" onClick={() => setActivePage('Home')} aria-label="Go to home">
        <svg className="brand-logo-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/>
          <path d="M6 6h10"/>
          <path d="M6 10h7"/>
        </svg>
        <span className="brand-name">Amar Library</span>
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
        {toggleTheme && (
          <button
            type="button"
            className="nav-tool theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2"/><path d="M12 20v2"/>
                <path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
                <path d="M2 12h2"/><path d="M20 12h2"/>
                <path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
            )}
          </button>
        )}

        <button type="button" className="nav-tool" onClick={() => setActivePage('Books')} aria-label="Browse books" title="Search books">⌕</button>
        <button type="button" className="nav-tool" onClick={() => setActivePage('Favorites')} aria-label="View favorites" title="Favorites">♡</button>
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
