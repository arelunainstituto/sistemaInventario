#!/bin/bash

# Script para configurar o MCP Supabase no Claude Desktop (macOS/Linux)

CONFIG_DIR=""
CONFIG_FILE=""

# Detectar sistema operacional
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    CONFIG_DIR="$HOME/Library/Application Support/Claude"
    CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    CONFIG_DIR="$HOME/.config/Claude"
    CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
else
    echo "Sistema operacional não suportado. Use Windows? Execute setup.ps1"
    exit 1
fi

echo "🚀 Configurando MCP Supabase para Claude Desktop..."
echo ""

# Criar diretório se não existir
if [ ! -d "$CONFIG_DIR" ]; then
    echo "📁 Criando diretório de configuração..."
    mkdir -p "$CONFIG_DIR"
fi

# Backup do arquivo existente
if [ -f "$CONFIG_FILE" ]; then
    echo "💾 Fazendo backup da configuração existente..."
    cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Copiar configuração
echo "📝 Copiando configuração do MCP..."
cp claude_desktop_config.json "$CONFIG_FILE"

echo ""
echo "✅ Configuração concluída!"
echo ""
echo "📍 Arquivo de configuração: $CONFIG_FILE"
echo ""
echo "⚠️  PRÓXIMOS PASSOS:"
echo "1. Reinicie o Claude Desktop completamente"
echo "2. Procure pelo ícone de ferramentas (🔌) na interface"
echo "3. Teste com: 'Liste as tabelas do meu banco Supabase'"
echo ""
echo "📚 Consulte README.md para mais informações"
