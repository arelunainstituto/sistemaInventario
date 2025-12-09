# Script para configurar o MCP Supabase no Claude Desktop (Windows)

$ConfigDir = "$env:APPDATA\Claude"
$ConfigFile = "$ConfigDir\claude_desktop_config.json"

Write-Host "🚀 Configurando MCP Supabase para Claude Desktop..." -ForegroundColor Green
Write-Host ""

# Criar diretório se não existir
if (-not (Test-Path $ConfigDir)) {
    Write-Host "📁 Criando diretório de configuração..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null
}

# Backup do arquivo existente
if (Test-Path $ConfigFile) {
    $BackupFile = "$ConfigFile.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Write-Host "💾 Fazendo backup da configuração existente..." -ForegroundColor Yellow
    Copy-Item $ConfigFile $BackupFile
}

# Copiar configuração
Write-Host "📝 Copiando configuração do MCP..." -ForegroundColor Yellow
Copy-Item "claude_desktop_config.json" $ConfigFile -Force

Write-Host ""
Write-Host "✅ Configuração concluída!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Arquivo de configuração: $ConfigFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  PRÓXIMOS PASSOS:" -ForegroundColor Yellow
Write-Host "1. Reinicie o Claude Desktop completamente"
Write-Host "2. Procure pelo ícone de ferramentas (🔌) na interface"
Write-Host "3. Teste com: 'Liste as tabelas do meu banco Supabase'"
Write-Host ""
Write-Host "📚 Consulte README.md para mais informações" -ForegroundColor Cyan
