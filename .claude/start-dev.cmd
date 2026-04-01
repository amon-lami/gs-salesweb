@echo off
:: リポジトリルート（.claudeフォルダの親）に移動
cd /d "%~dp0.."

:: PATH に npm があればそのまま使用、なければ Windows の一般的なインストール先を追加
where npm 1>nul 2>nul
if %ERRORLEVEL% == 0 goto :run

set PATH=C:\Program Files\nodejs;%PATH%
where npm 1>nul 2>nul
if %ERRORLEVEL% == 0 goto :run

echo.
echo [ERROR] npm が見つかりません。Node.js をインストールしてください。
echo   https://nodejs.org/
echo.
exit /b 1

:run
npm run dev
