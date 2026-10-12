from fastapi import FastAPI

app = FastAPI(title="Block Exchange")

@app.get("/")
def home():
    return {"status": "Block Exchange running"}
