from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles


app = FastAPI(title="PM MVP Backend")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


frontend_dir = Path(__file__).resolve().parents[2] / "frontend" / "out"

if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
else:
    @app.get("/", response_class=HTMLResponse)
    def index() -> str:
        return """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PM MVP Backend</title>
  </head>
  <body>
    <main>
      <h1>Frontend assets not built yet</h1>
      <p>Build frontend export to serve Kanban board at /.</p>
    </main>
  </body>
</html>
"""
