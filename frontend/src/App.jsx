import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './index.css';

// Automatically use the live Google Cloud URL if deployed, otherwise fallback to localhost!
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function App() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  const [currentView, setCurrentView] = useState('search'); // 'search' or 'watchlist'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Check for an active user session on startup
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    
    return () => subscription.unsubscribe();
  }, []);

  // Fetch watchlist whenever calculating the watchlist view
  useEffect(() => {
    if (session && currentView === 'watchlist') {
      fetchWatchlist();
    }
  }, [currentView, session]);

  // --- AUTH METHODS ---
  const handleSignUp = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert(error.message);
    else alert('Success! Try logging in right now!');
    setAuthLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // --- API METHODS ---
  // Helper to get auth headers easily
  const getHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    };
  };

  const fetchWatchlist = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/watchlist`, { headers: getHeaders() });
      if (!res.ok) throw new Error("Failed to fetch watchlist");
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
      // Notice we don't need auth headers for totally public routes like searching OMDB!
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Search failed");
      }
      const data = await res.json();
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
      poster_url: movie.Poster === 'N/A' ? '' : movie.Poster,
      type: movie.Type
    };
    
    try {
      const res = await fetch(`${API_BASE}/watchlist`, {
        method: 'POST',
        headers: getHeaders(),
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
        method: 'DELETE',
        headers: getHeaders(), // Security: Must prove who we are to delete
      });
      fetchWatchlist(); // Refresh the list automatically
    } catch (err) {
      console.error(err);
    }
  };

  // --- RENDER LOGIC ---
  
  // If no user is logged in, only show the Auth screen!
  if (!session) {
    return (
      <div className="app-container" style={{maxWidth: '400px', marginTop: '10vh'}}>
         <h1 style={{textAlign: 'center', marginBottom: '2rem'}} className="logo">PopcornTracker</h1>
         <div className="movie-card" style={{padding: '2rem'}}>
            <h2 style={{marginBottom: '1.5rem'}}>Sign In to Your Watchlist</h2>
            <form onSubmit={handleLogin} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
              <input 
                 type="email" 
                 placeholder="Email" 
                 className="search-input" 
                 style={{backgroundColor: 'var(--bg-color)', border: '1px solid #333'}}
                 value={email} 
                 onChange={(e) => setEmail(e.target.value)}
                 required 
              />
              <input 
                 type="password" 
                 placeholder="Password" 
                 className="search-input"
                 style={{backgroundColor: 'var(--bg-color)', border: '1px solid #333'}}
                 value={password} 
                 onChange={(e) => setPassword(e.target.value)}
                 required 
              />
              <button type="submit" className="btn-primary" disabled={authLoading}>
                {authLoading ? 'Loading...' : 'Sign In'}
              </button>
              <button type="button" className="btn-action" onClick={handleSignUp} disabled={authLoading}>
                Create an Account
              </button>
            </form>
         </div>
      </div>
    );
  }

  // If user IS logged in, show the main application!
  return (
    <div className="app-container">
      <header>
        <div className="logo">PopcornTracker</div>
        <nav style={{display: 'flex', alignItems: 'center'}}>
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
          
          <div style={{width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.2)', marginLeft: '1.5rem'}}></div>
          
          <button onClick={handleLogout} className="btn-action btn-danger" style={{marginLeft: '1.5rem', padding: '0.4rem 0.8rem'}}>
            Sign Out
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
            <h2 style={{marginBottom: '2rem'}}>Your Private Watchlist</h2>
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
