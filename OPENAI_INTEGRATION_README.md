# 🤖 Integración con OpenAI GPT-4o

## ✅ Implementación Completada

Se ha integrado OpenAI GPT-4o para manejar las conversaciones del bot en lugar de una máquina de estados hardcodeada.

## 📁 Archivos Creados/Modificados

### 1. `openai-client.js` (NUEVO)
Módulo que maneja las llamadas a la API de OpenAI.

**Funciones principales:**
- `buildSystemPrompt()` - Construye el system prompt desde `business_config.json`
- `getAIResponse(session, userMessage)` - Obtiene respuesta de OpenAI usando el historial de sesión

**Características:**
- Usa modelo `gpt-4o`
- Incluye los últimos 10 mensajes del historial en el contexto
- `max_tokens: 500`
- `temperature: 0.7`
- Fallback a respuesta por defecto si OpenAI falla

### 2. `sessions.js` (YA CREADO)
Gestiona el estado de las conversaciones y el historial de mensajes.

### 3. `whatsapp-calendar-bot.js` (MODIFICADO)
- ✅ Importa `sessions` y `openai-client`
- ✅ Reemplazada máquina de estados hardcodeada por llamadas a OpenAI
- ✅ Usa sesiones para mantener contexto de conversación
- ✅ Agrega mensajes al historial automáticamente

### 4. `package.json` (MODIFICADO)
- ✅ Agregado `openai: ^4.20.0` a dependencias

### 5. `env.example` (MODIFICADO)
- ✅ Agregado `OPENAI_API_KEY` a variables de entorno

## 🔧 Configuración

### 1. Instalar dependencias

```bash
npm install
```

### 2. Obtener API Key de OpenAI

1. Ve a https://platform.openai.com/api-keys
2. Crea una nueva API key
3. Cópiala

### 3. Agregar al `.env`

```env
OPENAI_API_KEY=sk-tu-api-key-aqui
```

## 🚀 Cómo Funciona

### Flujo de Conversación

1. **Usuario envía mensaje** → Webhook recibe el mensaje
2. **Obtener sesión** → `sessions.getSession(phone)` obtiene o crea sesión
3. **Agregar al historial** → Mensaje del usuario se agrega al historial
4. **Llamar a OpenAI** → `getAIResponse(session, message)` con:
   - System prompt (construido desde `business_config.json`)
   - Últimos 10 mensajes del historial
   - Mensaje actual del usuario
5. **Agregar respuesta** → Respuesta de OpenAI se agrega al historial
6. **Enviar respuesta** → Se envía al usuario por WhatsApp

### System Prompt

El system prompt se construye dinámicamente desde `business_config.json` e incluye:
- Información del negocio (nombre, dirección, horarios)
- Personalidad de la asesora
- Reglas de respuesta
- Objetivos de conversación
- Restricciones y límites

## 📊 Estructura de Mensajes

Los mensajes en el historial tienen esta estructura:

```javascript
{
  role: 'user' | 'assistant' | 'system',
  content: 'Texto del mensaje',
  timestamp: '2025-02-19T02:48:54.798Z'
}
```

## ⚙️ Parámetros de OpenAI

```javascript
{
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: buildSystemPrompt() },
    ...session.historial.slice(-10),  // Últimos 10 mensajes
    { role: 'user', content: userMessage }
  ],
  max_tokens: 500,
  temperature: 0.7
}
```

## 🔄 Migración desde Máquina de Estados

**Antes:**
- Máquina de estados hardcodeada con pasos fijos
- Lógica de conversación en el código
- Difícil de modificar sin cambiar código

**Ahora:**
- OpenAI maneja el flujo de conversación
- Lógica en el system prompt (fácil de modificar)
- Más flexible y natural
- Contexto completo de la conversación

## ⚠️ Notas Importantes

1. **Costo**: Cada mensaje consume tokens de OpenAI. Monitorea el uso en https://platform.openai.com/usage
2. **Rate Limits**: OpenAI tiene límites de rate. El código maneja errores pero puede necesitar retry logic
3. **Fallback**: Si OpenAI falla, se usa `getDefaultResponse()` como fallback
4. **Historial**: Se limita a los últimos 10 mensajes para mantener el contexto sin exceder límites de tokens

## 🧪 Prueba

```bash
# Asegúrate de tener OPENAI_API_KEY en .env
npm start

# Envía un mensaje de prueba al bot
# Deberías ver en los logs:
# 🤖 Llamando a OpenAI con X mensajes en contexto
# ✅ Respuesta de OpenAI recibida (X caracteres)
```

## 🔍 Troubleshooting

### "OPENAI_API_KEY no está configurado"
- Verifica que `OPENAI_API_KEY` esté en tu `.env`
- Reinicia el bot después de agregar la variable

### "Error con OpenAI, usando respuesta por defecto"
- Verifica que la API key sea válida
- Revisa los logs para el error específico
- Verifica tu balance en OpenAI

### Respuestas muy largas
- Ajusta `max_tokens` en `openai-client.js`
- Actualmente está en 500 tokens

---

**Integración con OpenAI completada!** 🎉
