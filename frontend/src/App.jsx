import { useState, useEffect } from 'react';
import './index.css';

// Automatically use the live Google Cloud URL if deployed, otherwise fallback to localhost!
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";

function App() {
  const [currentView, setCurrentView] = useState('search'); // 'search' or 'watchlist'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch watchlist whenever calculating the watchlist view
  useEffect(() => {
    if (currentView === 'watchlist') {
      fetchWatchlist();
    }
  }, [currentView]);

  const fetchWatchlist = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/watchlist`);
      const data = await res.json();
      setWatchlist(data);
    } catch (err) {
      console.error("Failed to fetch watchlist:", err);
    }
    setLoading(false);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    setError(null);
    setSearchResults([]);
    
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Search failed");
      }
      const data = await res.json();
      // The OMDB API returns an array inside the `Search` key
      setSearchResults(data.Search || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const addToWatchlist = async (movie) => {
    const item = {
      imdb_id: movie.imdbID,
      title: movie.Title,
      year: movie.Year,
      // Some movies don't have a poster, we conditionally handle the 'N/A' string
      poster_url: movie.Poster === 'N/A' ? '' : movie.Poster,
      type: movie.Type
    };
    
    try {
      const res = await fetch(`${API_BASE}/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (!res.ok) throw new Error("Failed to add");
      alert("Added to Watchlist!");
    } catch (err) {
      console.error(err);
      alert("Could not add to watchlist. It might already exist.");
    }
  };

  const removeFromWatchlist = async (imdb_id) => {
    try {
      await fetch(`${API_BASE}/watchlist/${imdb_id}`, {
        method: 'DELETE'
      });
      fetchWatchlist(); // Refresh the list automatically
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="app-container">
      <header>
        <div className="logo">PopcornTracker</div>
        <nav>
          <button 
            className={currentView === 'search' ? 'active' : ''} 
            onClick={() => setCurrentView('search')}
          >
            Find Movies
          </button>
          <button 
            className={currentView === 'watchlist' ? 'active' : ''} 
            onClick={() => setCurrentView('watchlist')}
          >
            My Watchlist
          </button>
        </nav>
      </header>

      <main>
        {currentView === 'search' ? (
          <div className="view-search">
            <form className="search-container" onSubmit={handleSearch}>
              <input 
                type="text" 
                className="search-input" 
                placeholder="Search for a movie, show, or series..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" className="btn-primary">Search</button>
            </form>

            {loading && <div className="loading">Searching the database...</div>}
            {error && <div className="empty-state">{error}</div>}

            <div className="movie-grid">
              {!loading && searchResults.map(movie => (
                <div className="movie-card" key={movie.imdbID}>
                  <div className="poster-container">
                    {movie.Poster !== 'N/A' && (
                      <img src={movie.Poster} alt={movie.Title} className="poster-img" />
                    )}
                  </div>
                  <div className="card-content">
                    <h3 className="movie-title" title={movie.Title}>{movie.Title}</h3>
                    <p className="movie-year">{movie.Year} • <span style={{textTransform:'capitalize'}}>{movie.Type}</span></p>
                    <button className="btn-action" onClick={() => addToWatchlist(movie)}>
                      + Add to Watchlist
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="view-watchlist">
            <h2 style={{marginBottom: '2rem'}}>Your Saved Movies & Shows</h2>
            {loading && <div className="loading">Loading your watchlist...</div>}
            
            <div className="movie-grid">
              {!loading && watchlist.length === 0 && (
                <div className="empty-state">Your watchlist is empty. Go find some movies!</div>
              )}
              {!loading && watchlist.map(movie => (
                <div className="movie-card" key={movie.imdb_id}>
                  <div className="poster-container">
                    {movie.poster_url && (
                      <img src={movie.poster_url} alt={movie.title} className="poster-img" />
                    )}
                  </div>
                  <div className="card-content">
                    <h3 className="movie-title" title={movie.title}>{movie.title}</h3>
                    <p className="movie-year">{movie.year} • <span style={{textTransform:'capitalize'}}>{movie.type}</span></p>
                    <button className="btn-action btn-danger" onClick={() => removeFromWatchlist(movie.imdb_id)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
