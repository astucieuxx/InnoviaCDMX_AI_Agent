# 🔗 Configuración de Chakra (BSP de WhatsApp)

## 📋 Información General

Chakra es un BSP (Business Service Provider) que conecta tu número de WhatsApp Business a la API, permitiendo:
- ✅ Coexistencia: Tu cliente puede usar su mismo número normalmente
- ✅ API simplificada: Endpoint único para enviar mensajes
- ✅ Webhooks estándar: Formato WhatsApp Cloud API

---

## 🔑 Paso 1: Obtener API Key de Chakra

1. Inicia sesión en tu panel de Chakra: **https://chakrahq.com/** (o la URL que te proporcionaron)
2. Ve a la sección de **"API Keys"** o **"Configuración"**
3. Busca tu API Key con rol **"Chakra Bot"**
4. Si no tienes una, créala con el rol adecuado
5. **Copia el API Key**

---

## 📝 Paso 2: Configurar Variables de Entorno

Abre tu archivo `.env` y agrega:

```env
# Chakra (BSP de WhatsApp)
CHAKRA_API_KEY=tu_api_key_de_chakra_aqui
VERIFY_TOKEN=mi_token_seguro_123

# Google Calendar
CALENDAR_ID=primary
GOOGLE_CREDENTIALS_PATH=./credentials.json

# Servidor
PORT=3000
```

**Ejemplo:**
```env
CHAKRA_API_KEY=chk_live_abc123xyz789...
VERIFY_TOKEN=whatsapp_webhook_2025
CALENDAR_ID=primary
GOOGLE_CREDENTIALS_PATH=./credentials.json
PORT=3000
```

---

## 🌐 Paso 3: Configurar ngrok (Desarrollo Local)

### Instalar ngrok:

```bash
# En Mac:
brew install ngrok

# O descarga desde: https://ngrok.com/download
```

### Exponer tu servidor:

1. **Inicia el bot** en una terminal:
   ```bash
   npm start
   ```

2. **En otra terminal, ejecuta ngrok**:
   ```bash
   ngrok http 3000
   ```

3. **Copia la URL HTTPS** que te da ngrok:
   ```
   Forwarding  https://abc123.ngrok.io -> http://localhost:3000
   ```
   URL a usar: `https://abc123.ngrok.io`

---

## 🔧 Paso 4: Configurar Webhook en Chakra

1. Ve a tu panel de Chakra
2. Busca la sección **"Webhooks"** o **"Integraciones"**
3. Configura el webhook:
   - **URL**: `https://abc123.ngrok.io/webhook` (la URL de ngrok)
   - **Método**: `POST`
   - **Verify Token** (si lo pide): El mismo que en tu `.env` (ej: `whatsapp_webhook_2025`)
4. **Guarda** la configuración

### Eventos a suscribir:

Asegúrate de suscribirte a:
- ✅ **messages** (mensajes entrantes)
- Opcional: **message_status** (estado de mensajes enviados)

---

## ✅ Paso 5: Verificar que Funciona

### 1. Reinicia el bot:

```bash
npm start
```

Deberías ver:
```
✅ Bot de WhatsApp escuchando en puerto 3000
📱 Proveedor: Chakra (BSP de WhatsApp)
🔑 Chakra API Key: Configurado
```

### 2. Prueba enviando un mensaje:

Envía "hola" al número de WhatsApp Business conectado a Chakra.

Deberías ver en los logs:
```
📥 Webhook recibido de Chakra: {...}
📨 Mensaje de +5215521920710: hola
✅ Mensaje enviado a 5215521920710 via Chakra
```

### 3. Verificar el webhook manualmente:

```bash
# Prueba GET (si Chakra lo requiere)
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=mi_token_seguro_123&hub.challenge=test123"

# Deberías recibir: test123
```

---

## 🔍 Formato del Webhook de Chakra

El código está preparado para manejar el formato estándar WhatsApp Cloud API:

### Formato esperado (estándar):

```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "5215521920710",
          "type": "text",
          "text": {
            "body": "hola"
          }
        }]
      }
    }]
  }]
}
```

### Formato alternativo (si Chakra usa otro):

El código también maneja:
- Formato directo: `{ from: "...", text: "..." }`
- Formato simplificado: `{ messages: [...] }`

**Si Chakra usa un formato diferente**, comparte un ejemplo del payload y lo adapto.

---

## 🐛 Troubleshooting

### "No llegan mensajes"

1. **Verifica ngrok está corriendo**:
   ```bash
   # Deberías ver la URL activa
   ngrok http 3000
   ```

2. **Verifica el webhook en Chakra**:
   - La URL debe ser HTTPS (ngrok lo proporciona)
   - Debe apuntar a `/webhook`
   - Debe estar activo

3. **Revisa los logs del bot**:
   - Deberías ver `📥 Webhook recibido de Chakra` cuando llega un mensaje
   - Si no ves nada, el webhook no está llegando

### "Error al enviar mensaje"

1. **Verifica CHAKRA_API_KEY**:
   ```bash
   # Verifica que esté en .env
   cat .env | grep CHAKRA
   ```

2. **Verifica el rol del API Key**:
   - Debe tener rol "Chakra Bot"
   - Debe tener permisos para enviar mensajes

3. **Revisa el error en los logs**:
   - El error mostrará qué está fallando

### "Webhook no se verifica"

- Algunos BSPs no requieren verificación GET
- El código maneja ambos casos
- Si Chakra requiere verificación, usa el mismo `VERIFY_TOKEN` en ambos lados

---

## 📊 Ver Logs en Tiempo Real

Para ver qué está recibiendo el bot:

```bash
# Los logs mostrarán el payload completo
📥 Webhook recibido de Chakra: {...}
```

Si el formato es diferente, comparte el log y lo adapto.

---

## 🚀 Checklist de Configuración

- [ ] API Key de Chakra obtenida y configurada en `.env`
- [ ] VERIFY_TOKEN configurado (igual en `.env` y Chakra si lo requiere)
- [ ] Bot iniciado (`npm start`)
- [ ] ngrok corriendo (`ngrok http 3000`)
- [ ] Webhook configurado en Chakra con URL de ngrok
- [ ] Webhook activo y suscrito a "messages"
- [ ] Mensaje de prueba enviado y recibido

---

## 📞 Próximos Pasos

Una vez configurado:
1. El bot recibirá mensajes vía webhook de Chakra
2. El bot responderá usando la API de Chakra
3. Google Calendar seguirá funcionando normalmente
4. Tu cliente puede usar su número normalmente (coexistencia)

¿Necesitas ayuda con algún paso específico?
