# 📱 Configuración del Webhook en Meta (WhatsApp Business API)

## ✅ Ventajas de usar Meta API

- **Coexistencia**: Tu cliente puede usar su mismo número de WhatsApp
- **Sin número separado**: No necesitas Twilio ni números adicionales
- **API oficial**: Soporte directo de Meta/Facebook

---

## 🔧 Configuración del Webhook

### 1. Obtener Credenciales

Asegúrate de tener en tu `.env`:
```env
WHATSAPP_TOKEN=tu_token_de_meta
PHONE_NUMBER_ID=tu_phone_number_id
VERIFY_TOKEN=mi_token_seguro_123
```

### 2. Configurar Webhook en Meta Developer Console

1. Ve a: **https://developers.facebook.com/**
2. Selecciona tu aplicación
3. Ve a **"WhatsApp"** → **"Configuración"** → **"API Setup"**
4. Busca la sección **"Webhooks"**
5. Haz clic en **"Configurar webhooks"** o **"Edit"**

### 3. Configurar la URL del Webhook

1. **Callback URL**: 
   - Si estás en desarrollo local: usa ngrok
   - Ejemplo: `https://abc123.ngrok.io/webhook`
   - Si estás en producción: `https://tu-dominio.com/webhook`

2. **Verify Token**: 
   - Usa el mismo que tienes en tu `.env`: `VERIFY_TOKEN`
   - Ejemplo: `mi_token_seguro_123`

3. Haz clic en **"Verificar y guardar"**

### 4. Suscribirse a Eventos

En la misma sección de Webhooks, suscríbete a:
- ✅ **messages** (mensajes entrantes)
- Opcional: **message_status** (estado de mensajes enviados)

### 5. Verificar que Funciona

1. Reinicia tu bot: `npm start`
2. Deberías ver: `✅ Webhook verificado por Meta`
3. Envía un mensaje de prueba a tu número de WhatsApp
4. Deberías ver en los logs: `📨 Mensaje de +5215521920710: ...`

---

## 🌐 Usar ngrok para Desarrollo Local

Si estás probando en localhost:

```bash
# Instalar ngrok (si no lo tienes)
brew install ngrok

# En una terminal, inicia el bot
npm start

# En OTRA terminal, ejecuta ngrok
ngrok http 3000
```

ngrok te dará una URL como: `https://abc123.ngrok.io`

Usa esa URL en la configuración del webhook de Meta.

---

## 🔍 Verificar que el Webhook Funciona

### Prueba manual:

```bash
# Verificar el webhook (GET)
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=mi_token_seguro_123&hub.challenge=test123"

# Deberías recibir: test123
```

### Ver logs del bot:

Cuando Meta envíe un mensaje, deberías ver:
```
📨 Mensaje de +5215521920710: hola
✅ Mensaje enviado a 5215521920710
```

---

## ⚠️ Problemas Comunes

### "Webhook verification failed"
- Verifica que `VERIFY_TOKEN` en `.env` sea igual al de Meta
- Asegúrate de que la URL sea accesible públicamente (usa ngrok si estás en localhost)

### "No llegan mensajes"
- Verifica que estés suscrito a "messages" en Meta
- Revisa los logs del bot para ver si llegan los webhooks
- Verifica que `PHONE_NUMBER_ID` sea correcto

### "Invalid OAuth access token"
- Regenera el token en Meta Developer Console
- Asegúrate de que el token tenga permisos de `whatsapp_business_messaging`

---

## 📝 Variables de Entorno Requeridas

```env
# WhatsApp Business API (Meta)
WHATSAPP_TOKEN=tu_token_de_meta
PHONE_NUMBER_ID=tu_phone_number_id
VERIFY_TOKEN=mi_token_seguro_123

# Google Calendar
CALENDAR_ID=primary
GOOGLE_CREDENTIALS_PATH=./credentials.json
# O usar GOOGLE_CREDENTIALS con el JSON completo

# Servidor
PORT=3000
```

---

## ✅ Checklist

- [ ] Token de WhatsApp obtenido de Meta
- [ ] Phone Number ID configurado
- [ ] Webhook configurado en Meta Console
- [ ] Verify Token configurado (igual en .env y Meta)
- [ ] Suscrito a eventos "messages"
- [ ] URL del webhook accesible públicamente (ngrok o producción)
- [ ] Bot reiniciado después de cambios

¡Listo! Tu bot ahora usa la API oficial de Meta con coexistencia. 🎉
