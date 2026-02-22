# 🔧 Troubleshooting: Bot No Responde

## ✅ Checklist de Verificación

### 1. ¿El bot está corriendo?

En tu terminal, deberías ver:
```
✅ Bot de WhatsApp escuchando en puerto 3000
📱 Proveedor: Twilio WhatsApp Sandbox
```

**Si no ves esto:**
- Ejecuta: `npm start`
- Revisa si hay errores en la terminal

---

### 2. ¿El webhook de Twilio está configurado?

El bot espera mensajes en: `POST /whatsapp`

**Verifica en Twilio Console:**
1. Ve a: https://console.twilio.com/
2. WhatsApp → Sandbox Settings
3. Verifica que el **Webhook URL** apunte a:
   - Si estás en localhost: `http://localhost:3000/whatsapp` (NO funcionará, Twilio no puede alcanzar localhost)
   - Si estás en producción: `https://tu-dominio.com/whatsapp`

**⚠️ PROBLEMA COMÚN**: Si estás en localhost, Twilio NO puede enviar mensajes a tu computadora.

**Solución**: Necesitas exponer tu servidor local:
- Usa **ngrok** para crear un túnel público
- O despliega en Railway/Heroku

---

### 3. ¿Estás usando Twilio Sandbox?

Si estás en modo Sandbox:
1. Debes enviar el código de sandbox primero
2. El número debe estar: `whatsapp:+14155238886`
3. Debes enviar: `join [código]` al número de sandbox

---

### 4. ¿Ves logs cuando envías un mensaje?

Cuando envías un mensaje, deberías ver en la terminal:
```
📥 Mensaje entrante recibido: {...}
📨 Mensaje de +5215521920710: hola
✅ Mensaje enviado a +5215521920710
```

**Si NO ves estos logs:**
- El webhook no está llegando al servidor
- Verifica la URL del webhook en Twilio

---

## 🚀 Solución Rápida: Usar ngrok (Para Desarrollo Local)

### Instalar ngrok:
```bash
# En Mac con Homebrew:
brew install ngrok

# O descarga desde: https://ngrok.com/download
```

### Exponer tu servidor:
```bash
# En una terminal, inicia el bot:
npm start

# En OTRA terminal, ejecuta ngrok:
ngrok http 3000
```

### Configurar webhook en Twilio:
1. ngrok te dará una URL como: `https://abc123.ngrok.io`
2. En Twilio Console → WhatsApp → Sandbox Settings
3. Webhook URL: `https://abc123.ngrok.io/whatsapp`
4. Guarda

**Ahora Twilio podrá enviar mensajes a tu bot local**

---

## 🔍 Verificar que el Bot Recibe Mensajes

### Prueba manual con curl:
```bash
curl -X POST http://localhost:3000/whatsapp \
  -d "From=whatsapp:+5215521920710" \
  -d "Body=hola" \
  -d "MessageSid=test123"
```

Deberías ver en los logs:
```
📥 Mensaje entrante recibido: {...}
📨 Mensaje de +5215521920710: hola
```

---

## 📝 Verificar Variables de Entorno

Asegúrate de tener en tu `.env`:
```env
TWILIO_ACCOUNT_SID=tu_account_sid
TWILIO_AUTH_TOKEN=tu_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

---

## 🎯 Pasos Siguientes

1. **Verifica que el bot esté corriendo** (terminal)
2. **Verifica el webhook en Twilio Console**
3. **Si estás en localhost, usa ngrok**
4. **Revisa los logs cuando envías un mensaje**

¿Qué ves en tu terminal cuando envías un mensaje?
