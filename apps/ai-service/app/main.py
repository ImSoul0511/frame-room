from fastapi import FastAPI

app = FastAPI(title="FrameRoom AI Service", version="0.1.0")

@app.get("/health")
def health() -> dict[str, object]:
    return {"ok": True, "service": "ai-service"}
