# 🔧 Actualizar .env con Plugin ID de Chakra

## ✅ Plugin ID Encontrado

De la URL que compartiste, el Plugin ID es:
```
32b42eb8-d886-429d-a0c2-12964b08bf21
```

## 📝 Agregar al .env

Abre tu archivo `.env` y agrega o actualiza estas líneas:

```env
# Chakra (BSP de WhatsApp)
CHAKRA_API_KEY=hG6u05UeQmtue77P4K0RSQYFuFioZAi1ZJEKSAEDXbAv3pkwGe69pfQboe7Du2ZA1n8eWmtiwrijpGneV2zgmQyDbljjN0FCvm3HdXF5JvcQh2m8YwsnU2tnau0FNLabxQ2BrcRfYFosjsRVxj3JiKQRPd5Vx9vOgmQVgN7DHrVeQkJcFOHlZpLb0RmdZZR8uiwWrKFXVkkXm1OOneIsRbQ6XzJPTu2Lyh9SqusN8RxmgeKd0vJwUtdqE2hy8He
CHAKRA_PLUGIN_ID=32b42eb8-d886-429d-a0c2-12964b08bf21
CHAKRA_WHATSAPP_API_VERSION=v18.0

# Token de verificación del webhook
VERIFY_TOKEN=mi_token_seguro_123

# Google Calendar
CALENDAR_ID=primary
GOOGLE_CREDENTIALS_PATH=./credentials.json

# Servidor
PORT=3000
```

## 🚀 Después de Actualizar

1. **Guarda el archivo `.env`**
2. **Reinicia el bot**:
   ```bash
   npm start
   ```
3. **Envía un mensaje de prueba** al número conectado a Chakra
4. **Verifica los logs** - deberías ver:
   ```
   📱 Phone Number ID extraído: 991221180742574
   📤 Enviando mensaje a: https://api.chakrahq.com/v1/ext/plugin/whatsapp/32b42eb8-d886-429d-a0c2-12964b08bf21/api/v18.0/991221180742574/messages
   ✅ Mensaje enviado a 5215521920710 via Chakra
   ```

## ✅ Listo!

Con esto, el bot debería poder enviar mensajes correctamente usando la API de Chakra.
