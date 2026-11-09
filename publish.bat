@echo off
REM ============================================================
REM  publish.bat  -  push the public site to GitHub Pages
REM
REM  Use this after you edit anything in the admin panel.
REM  It commits the site files and pushes them.
REM
REM  It will NOT touch: medarena-users.json, admin-auth.json,
REM  auth-config.json, backups\, admin.html, admin-server.py
REM  (all excluded by .gitignore).
REM ============================================================

setlocal
cd /d "%~dp0"

echo.
echo === MedArena publish ===
echo.

REM --- is this a git repo yet? ---
if not exist ".git" (
  echo This folder is not a git repository yet.
  echo Run the one-time setup first - see PUBLISHING.md
  echo.
  pause
  exit /b 1
)

REM --- make sure a remote is configured ---
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo No 'origin' remote is set.
  echo Run:  git remote add origin https://github.com/YOURNAME/YOURREPO.git
  echo.
  pause
  exit /b 1
)

REM --- show what changed ---
echo Files that will be published:
echo.
git status --short
echo.

REM --- anything to do? ---
git diff --quiet && git diff --cached --quiet
if not errorlevel 1 (
  echo Nothing has changed since the last publish.
  echo.
  pause
  exit /b 0
)

REM --- commit ---
set STAMP=%DATE% %TIME%
git add -A
git commit -m "Update site %STAMP%"
if errorlevel 1 (
  echo.
  echo Commit failed. Nothing was pushed.
  pause
  exit /b 1
)

REM --- push ---
echo.
echo Pushing to GitHub...
git push origin HEAD
if errorlevel 1 (
  echo.
  echo Push failed. Your commit is saved locally; fix the error and run this again.
  pause
  exit /b 1
)

echo.
echo Done. GitHub Pages usually updates in about a minute.
echo Open your site and hard-refresh with Ctrl+F5 to see the change.
echo.
pause
