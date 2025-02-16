from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import upload, query

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (change in production)
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

# Register API Routes
app.include_router(upload.router, prefix="/api")
app.include_router(query.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "Welcome to Project Oath Speaker API"}
