# 📱 Guía: Configurar WhatsApp Business de tu Cliente

## 📋 Información que Necesitas Obtener

Para conectar el bot con el WhatsApp Business de tu cliente, necesitas:

1. **WHATSAPP_TOKEN** - Token de acceso de Meta
2. **PHONE_NUMBER_ID** - ID del número de teléfono de WhatsApp Business
3. **VERIFY_TOKEN** - Token de seguridad (lo creas tú)

---

## 🔑 Paso 1: Obtener WHATSAPP_TOKEN

### Opción A: Desde Meta Developer Console (Recomendado)

1. Ve a: **https://developers.facebook.com/**
2. Inicia sesión con la cuenta de Meta Business de tu cliente
3. Selecciona la aplicación de WhatsApp Business (o créala si no existe)
4. Ve a **"WhatsApp"** → **"Configuración"** → **"API Setup"**
5. Busca la sección **"Temporary access token"** o **"Access tokens"**
6. Haz clic en **"Generate token"** o **"Copy"**

⚠️ **Nota**: Este token es temporal (24 horas). Para uno permanente:
- Ve a **"Sistema"** → **"Tokens de acceso"**
- O usa: **https://developers.facebook.com/tools/explorer/**
- Genera un token con permisos: `whatsapp_business_messaging`, `whatsapp_business_management`

### Opción B: Token Permanente

1. Ve a: **https://developers.facebook.com/tools/explorer/**
2. Selecciona tu aplicación en el dropdown
3. Haz clic en **"Generate Access Token"**
4. Selecciona permisos:
   - ✅ `whatsapp_business_messaging`
   - ✅ `whatsapp_business_management`
5. Copia el token generado

**Copia este token** - será tu `WHATSAPP_TOKEN`

---

## 📞 Paso 2: Obtener PHONE_NUMBER_ID

1. En Meta Developer Console, ve a **"WhatsApp"** → **"Configuración"** → **"API Setup"**
2. Busca la sección **"From"** o **"Phone number ID"**
3. Verás un número que parece: `123456789012345`
4. **Copia este número** - será tu `PHONE_NUMBER_ID`

**Nota**: Si no ves un número:
- El número de WhatsApp Business debe estar registrado en Meta Business Account
- Puede requerir verificación del número

---

## 🔐 Paso 3: Crear VERIFY_TOKEN

Este es el más fácil - lo creas tú:

1. Crea cualquier cadena de texto segura
2. Ejemplo: `whatsapp_webhook_2025` o `mi_token_seguro_123`
3. **Anótalo** - lo usarás en el `.env` y cuando configures el webhook

---

## 📝 Paso 4: Actualizar el archivo .env

1. Abre tu archivo `.env` en la carpeta del proyecto
2. Agrega o actualiza estas líneas:

```env
# WhatsApp Business API (Meta)
WHATSAPP_TOKEN=tu_token_aqui
PHONE_NUMBER_ID=tu_phone_number_id_aqui
VERIFY_TOKEN=mi_token_seguro_123

# Google Calendar (si ya lo tenías configurado)
CALENDAR_ID=primary
GOOGLE_CREDENTIALS_PATH=./credentials.json

# Servidor
PORT=3000
```

### Ejemplo con valores reales:

```env
WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PHONE_NUMBER_ID=123456789012345
VERIFY_TOKEN=whatsapp_webhook_2025
CALENDAR_ID=primary
GOOGLE_CREDENTIALS_PATH=./credentials.json
PORT=3000
```

**Importante**:
- Sin comillas alrededor de los valores
- Sin espacios antes o después del `=`
- Copia los valores completos sin cortes

---

## 🌐 Paso 5: Configurar el Webhook en Meta

### Si estás en desarrollo local (usando ngrok):

1. Inicia ngrok:
   ```bash
   ngrok http 3000
   ```
2. Copia la URL que te da (ej: `https://abc123.ngrok.io`)

### Si estás en producción:

Usa la URL de tu servidor (ej: `https://tu-dominio.com`)

### Configurar en Meta:

1. Ve a: **https://developers.facebook.com/**
2. Selecciona tu aplicación
3. Ve a **"WhatsApp"** → **"Configuración"** → **"API Setup"**
4. Busca la sección **"Webhooks"**
5. Haz clic en **"Configurar webhooks"** o **"Edit"**
6. Completa:
   - **Callback URL**: `https://tu-url.com/webhook` (o la URL de ngrok)
   - **Verify Token**: El mismo que pusiste en `.env` (ej: `whatsapp_webhook_2025`)
7. Haz clic en **"Verificar y guardar"**
8. Deberías ver: ✅ "Webhook verificado"

### Suscribirse a Eventos:

En la misma sección, marca:
- ✅ **messages** (mensajes entrantes)
- Opcional: **message_status** (estado de mensajes)

---

## ✅ Paso 6: Verificar que Funciona

1. **Reinicia el bot**:
   ```bash
   npm start
   ```

2. **Deberías ver**:
   ```
   ✅ Bot de WhatsApp escuchando en puerto 3000
   📱 Proveedor: WhatsApp Business API (Meta)
   📞 Phone Number ID: 123456789012345
   ```

3. **Prueba enviando un mensaje**:
   - Envía "hola" al número de WhatsApp Business de tu cliente
   - Deberías ver en los logs:
     ```
     📨 Mensaje de +5215521920710: hola
     ✅ Mensaje enviado a 5215521920710
     ```

---

## 🔍 Verificación Rápida

### Verificar el webhook manualmente:

```bash
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=mi_token_seguro_123&hub.challenge=test123"
```

Deberías recibir: `test123`

### Verificar variables de entorno:

Asegúrate de que todas estén configuradas:
- ✅ WHATSAPP_TOKEN
- ✅ PHONE_NUMBER_ID  
- ✅ VERIFY_TOKEN

---

## ⚠️ Problemas Comunes

### "Webhook verification failed"
- Verifica que `VERIFY_TOKEN` en `.env` sea **exactamente igual** al de Meta
- Sin espacios, sin comillas

### "Invalid OAuth access token"
- El token puede haber expirado (si es temporal)
- Genera uno nuevo en Meta Developer Console

### "No llegan mensajes"
- Verifica que estés suscrito a "messages" en Meta
- Verifica que el webhook esté configurado correctamente
- Revisa los logs del bot

### "PHONE_NUMBER_ID incorrecto"
- Verifica que el número esté registrado en Meta Business Account
- El ID debe ser el número, no el número de teléfono

---

## 📞 Checklist Final

- [ ] WHATSAPP_TOKEN obtenido y configurado en `.env`
- [ ] PHONE_NUMBER_ID obtenido y configurado en `.env`
- [ ] VERIFY_TOKEN creado y configurado (igual en `.env` y Meta)
- [ ] Webhook configurado en Meta Console
- [ ] Webhook verificado (debe mostrar ✅)
- [ ] Suscrito a eventos "messages"
- [ ] Bot reiniciado
- [ ] Mensaje de prueba enviado y recibido

---

## 🎉 ¡Listo!

Una vez completado todo, tu cliente podrá:
- ✅ Usar su mismo número de WhatsApp normalmente
- ✅ El bot responderá automáticamente
- ✅ Consultar Google Calendar en tiempo real
- ✅ Agendar citas automáticamente

¿Necesitas ayuda con algún paso específico?
