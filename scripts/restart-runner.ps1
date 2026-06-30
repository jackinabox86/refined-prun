Get-Process -Name "Runner.Worker" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "run" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2
Start-Process "C:\actions-runner\run.cmd"
