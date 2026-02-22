#!/bin/bash

# Script para obter Access Token e Instagram Account ID
# App: ProGenia Blog-IG
# App ID: 1442163880709941
# App Secret: ba503770dfd99ad6f76af10051a5fb7e

APP_ID="1442163880709941"
APP_SECRET="ba503770dfd99ad6f76af10051a5fb7e"

echo "🔐 ProGenia Blog-IG - Obter Credenciais"
echo "========================================"
echo ""
echo "1️⃣  Primeiro, obtenha um token de curta duração:"
echo "   Acesse: https://developers.facebook.com/tools/explorer/"
echo "   - Selecione o app 'ProGenia Blog-IG'"
echo "   - Clique em 'Generate Access Token'"
echo "   - Selecione permissões: instagram_basic, pages_read_engagement"
echo "   - Copie o token gerado"
echo ""
read -p "Cole o token de curta duração aqui: " SHORT_TOKEN

if [ -z "$SHORT_TOKEN" ]; then
  echo "❌ Token não fornecido. Saindo."
  exit 1
fi

echo ""
echo "🔄 Convertendo para token de longa duração (60 dias)..."
echo ""

LONG_TOKEN_RESPONSE=$(curl -s -X GET "https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${SHORT_TOKEN}")

LONG_TOKEN=$(echo $LONG_TOKEN_RESPONSE | grep -o '"access_token":"[^"]*' | cut -d'"' -f4)

if [ -z "$LONG_TOKEN" ]; then
  echo "❌ Erro ao obter token de longa duração:"
  echo "$LONG_TOKEN_RESPONSE"
  exit 1
fi

echo "✅ Token de longa duração obtido!"
echo ""
echo "📋 INSTAGRAM_ACCESS_TOKEN:"
echo "$LONG_TOKEN"
echo ""

echo "🔍 Buscando Instagram Account ID..."
echo ""

# Buscar páginas do Facebook
PAGES_RESPONSE=$(curl -s "https://graph.facebook.com/v18.0/me/accounts?access_token=${LONG_TOKEN}")

echo "📄 Páginas encontradas:"
echo "$PAGES_RESPONSE" | grep -o '"id":"[^"]*","name":"[^"]*' | sed 's/"id":"\([^"]*\)","name":"\([^"]*\)/  - \2 (ID: \1)/'

echo ""
read -p "Digite o PAGE_ID da página conectada ao Instagram (ou pressione Enter para buscar automaticamente): " PAGE_ID

if [ -z "$PAGE_ID" ]; then
  # Tentar buscar automaticamente
  PAGE_IDS=$(echo "$PAGES_RESPONSE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
  
  for pid in $PAGE_IDS; do
    INSTAGRAM_INFO=$(curl -s "https://graph.facebook.com/v18.0/${pid}?fields=instagram_business_account&access_token=${LONG_TOKEN}")
    INSTAGRAM_ID=$(echo "$INSTAGRAM_INFO" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    
    if [ ! -z "$INSTAGRAM_ID" ]; then
      echo ""
      echo "✅ Instagram Account ID encontrado!"
      echo ""
      echo "📋 INSTAGRAM_ACCOUNT_ID:"
      echo "$INSTAGRAM_ID"
      echo ""
      echo "🚀 Configure no Supabase:"
      echo "supabase secrets set INSTAGRAM_ACCESS_TOKEN=\"$LONG_TOKEN\""
      echo "supabase secrets set INSTAGRAM_ACCOUNT_ID=\"$INSTAGRAM_ID\""
      exit 0
    fi
  done
  
  echo "⚠️  Não foi possível encontrar automaticamente. Use o Graph API Explorer:"
  echo "   GET /me/accounts"
  echo "   Depois para cada PAGE_ID: GET /{PAGE_ID}?fields=instagram_business_account"
else
  INSTAGRAM_INFO=$(curl -s "https://graph.facebook.com/v18.0/${PAGE_ID}?fields=instagram_business_account&access_token=${LONG_TOKEN}")
  INSTAGRAM_ID=$(echo "$INSTAGRAM_INFO" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
  
  if [ -z "$INSTAGRAM_ID" ]; then
    echo "❌ Erro ao buscar Instagram Account ID:"
    echo "$INSTAGRAM_INFO"
    exit 1
  fi
  
  echo ""
  echo "✅ Instagram Account ID encontrado!"
  echo ""
  echo "📋 INSTAGRAM_ACCOUNT_ID:"
  echo "$INSTAGRAM_ID"
  echo ""
  echo "🚀 Configure no Supabase:"
  echo "supabase secrets set INSTAGRAM_ACCESS_TOKEN=\"$LONG_TOKEN\""
  echo "supabase secrets set INSTAGRAM_ACCOUNT_ID=\"$INSTAGRAM_ID\""
fi
