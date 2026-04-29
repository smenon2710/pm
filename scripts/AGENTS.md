This folder contains start and stop scripts for Mac, Linux, and Windows.

- `start-mac.sh` / `stop-mac.sh`
- `start-linux.sh` / `stop-linux.sh`
- `start-windows.ps1` / `stop-windows.ps1`

All scripts manage a single Docker container named `pm-mvp-app` that serves the backend on port `8000`.
Start scripts load environment variables from project `.env` when present so API keys (for example `OPENROUTER_API_KEY`) are available in the container.