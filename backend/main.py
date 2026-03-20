import os
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client
from fastapi import Header, Depends

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

# --- AUTHENTICATION ---
async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authentication token")
    
    token = authorization.split(" ")[1]
    
    # Supabase verifies the JWT token over the network against your project securely
    auth_response = supabase.auth.get_user(token)
    
    if not auth_response or not auth_response.user:
        raise HTTPException(status_code=401, detail="Invalid token or session expired")
        
    return auth_response.user

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
def get_watchlist(user = Depends(get_current_user)):
    """Retrieves all saved items from the Supabase watchlist table for the logged-in user."""
    res = supabase.table("watchlist").select("*").eq("user_id", user.id).order("created_at", desc=True).execute()
    return res.data

@app.post("/api/watchlist")
def add_to_watchlist(item: WatchlistItem, user = Depends(get_current_user)):
    """Saves a new movie/show to the Supabase watchlist, linking it to the user."""
    item_dict = item.model_dump()
    item_dict["user_id"] = user.id # Attach the authenticated user's ID to the saved movie
    res = supabase.table("watchlist").insert(item_dict).execute()
    return res.data

@app.delete("/api/watchlist/{imdb_id}")
def remove_from_watchlist(imdb_id: str, user = Depends(get_current_user)):
    """Removes an item from the watchlist."""
    # Ensure they can only delete their own movies!
    res = supabase.table("watchlist").delete().eq("imdb_id", imdb_id).eq("user_id", user.id).execute()
    return {"message": f"Removed {imdb_id} from watchlist"}
