from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

app = FastAPI()

# Super permissive CORS for testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "Test server running"}

@app.post("/test")
async def test():
    return {"status": "POST working"}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8001)
