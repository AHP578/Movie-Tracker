import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables from .env file expressly relative to this folder
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path, override=True)

# Let's print out the loaded key specifically for debugging
print(f"✅ Loaded OMDB Key: {os.getenv('OMDB_API_KEY')}")

app = FastAPI(title="Movie Tracker API")

# Setup CORS to allow our React frontend to communicate with the FastAPI backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins so Vercel can access it globally
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
OMDB_API_KEY = os.getenv("OMDB_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("WARNING: Supabase credentials not found in environment variables.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# --- MODELS ---
class WatchlistItem(BaseModel):
    imdb_id: str
    title: str
    year: str
    poster_url: str
    type: str

# --- ENDPOINTS ---
@app.get("/")
def read_root():
    return {"message": "Movie Tracker API is running!"}

@app.get("/api/search")
async def search_omdb(q: str):
    """Fetches search results from the OMDB API."""
    if not q:
        raise HTTPException(status_code=400, detail="Search query cannot be empty")
    
    url = f"http://www.omdbapi.com/?s={q}&apikey={OMDB_API_KEY}"
    
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        data = response.json()
        
        if "Error" in data:
            raise HTTPException(status_code=404, detail=data["Error"])
            
        return data

@app.get("/api/watchlist")
def get_watchlist():
    """Retrieves all saved items from the Supabase watchlist table."""
    res = supabase.table("watchlist").select("*").order("created_at", desc=True).execute()
    return res.data

@app.post("/api/watchlist")
def add_to_watchlist(item: WatchlistItem):
    """Saves a new movie/show to the Supabase watchlist."""
    # Convert Pydantic model to dict and insert into Supabase
    res = supabase.table("watchlist").insert(item.model_dump()).execute()
    return res.data

@app.delete("/api/watchlist/{imdb_id}")
def remove_from_watchlist(imdb_id: str):
    """Removes an item from the watchlist."""
    res = supabase.table("watchlist").delete().eq("imdb_id", imdb_id).execute()
    return {"message": f"Removed {imdb_id} from watchlist"}
