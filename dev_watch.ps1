# dev_watch.ps1
# Script to auto-restart the platform on every change

Write-Host "Starting file watcher for SignApps Platform..."
Write-Host "Any change to .rs, .tsx, .ts, or .css files will trigger a full restart via start_windows.ps1"
Write-Host ""
Write-Host "Press Ctrl+C to stop."

nodemon --watch "client\src" --watch "services" --watch "crates" -e "ts,tsx,css,rs" --exec "powershell.exe -ExecutionPolicy Bypass -NoProfile -File .\start_windows.ps1"
