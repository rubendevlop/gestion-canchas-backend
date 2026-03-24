Set-Location "g:\Proyectos nuevos\gestion-canchas\backend"
git remote set-url origin "https://github.com/rubendevlop/gestion-canchas-backend.git"
git add .
git status
git commit -m "fix: CORS for Vercel + register/login routes + auth flow"
git push origin main
Write-Host "Push completado."
