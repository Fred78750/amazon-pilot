# Amazon Pilot — Deploy Script v2
$downloads = "$env:USERPROFILE\Downloads"
$latest = Get-ChildItem $downloads -Filter "amazon-pilot-latest*.html" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $latest) { Write-Host "Aucun fichier amazon-pilot-latest*.html dans Downloads" -ForegroundColor Red; exit 1 }
Write-Host "Fichier : $($latest.Name) — $([math]::Round($latest.Length/1KB)) Ko — $($latest.LastWriteTime)" -ForegroundColor Cyan
Copy-Item $latest.FullName "C:\AmazonPilot\amazon-pilot-latest.html" -Force
aws s3 cp C:\AmazonPilot\amazon-pilot-latest.html s3://amazon-pilot-foliow/index.html
aws cloudfront create-invalidation --distribution-id E3ERL241475BJI --paths "/*"
Write-Host "Deploye !" -ForegroundColor Green
