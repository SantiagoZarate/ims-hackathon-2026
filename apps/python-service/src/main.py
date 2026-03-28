from fastapi import FastAPI

app = FastAPI(title="python-service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
