#!/bin/bash

echo "🔍 Verificando estado del bot..."
echo ""

# Verificar si el puerto 3000 está en uso
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✅ Puerto 3000 está en uso (bot probablemente corriendo)"
else
    echo "❌ Puerto 3000 NO está en uso"
    echo "   Ejecuta: npm start"
fi

echo ""
echo "📡 Verificando endpoint del bot..."
curl -s http://localhost:3000/health 2>&1 | head -5

echo ""
echo ""
echo "💡 Si el bot está corriendo pero no responde:"
echo "   1. Verifica el webhook en Twilio Console"
echo "   2. Si estás en localhost, usa ngrok: ngrok http 3000"
echo "   3. Configura el webhook de Twilio con la URL de ngrok"
