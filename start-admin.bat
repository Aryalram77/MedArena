@echo off
cd /d "%~dp0"
start "" http://127.0.0.1:8600/admin
python admin-server.py
pause
