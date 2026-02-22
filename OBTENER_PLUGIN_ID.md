# 🔑 Cómo Obtener el Plugin ID de Chakra

Según la documentación de Chakra, el Plugin ID se obtiene así:

## 📋 Pasos

1. **Ve a tu panel de Chakra**
2. **Navega a la página de configuración de WhatsApp** (WhatsApp Setup)
3. **Busca los 3 puntos (⋯)** en la esquina superior derecha, junto al botón "Save"
4. **Haz clic en los 3 puntos**
5. **Selecciona "Copy Plugin Id"**
6. **El Plugin ID se copiará al portapapeles**

## ✅ Agregar al .env

Una vez que tengas el Plugin ID, agrégalo a tu archivo `.env`:

```env
CHAKRA_PLUGIN_ID=tu_plugin_id_copiado_aqui
```

## 📝 Ejemplo Completo del .env

```env
# Chakra
CHAKRA_API_KEY=hG6u05UeQmtue77P4K0RSQYFuFioZAi1ZJEKSAEDXbAv3pkwGe69pfQboe7Du2ZA1n8eWmtiwrijpGneV2zgmQyDbljjN0FCvm3HdXF5JvcQh2m8YwsnU2tnau0FNLabxQ2BrcRfYFosjsRVxj3JiKQRPd5Vx9vOgmQVgN7DHrVeQkJcFOHlZpLb0RmdZZR8uiwWrKFXVkkXm1OOneIsRbQ6XzJPTu2Lyh9SqusN8RxmgeKd0vJwUtdqE2hy8He
CHAKRA_PLUGIN_ID=tu_plugin_id_aqui
CHAKRA_WHATSAPP_API_VERSION=v18.0

# Webhook
VERIFY_TOKEN=mi_token_seguro_123

# Google Calendar
CALENDAR_ID=primary
GOOGLE_CREDENTIALS_PATH=./credentials.json

# Servidor
PORT=3000
```

## ⚠️ Importante

- El `phone_number_id` se extrae automáticamente del webhook cuando recibes un mensaje
- No necesitas configurarlo manualmente
- El bot lo guardará automáticamente la primera vez que reciba un mensaje

## 🚀 Después de Configurar

1. Agrega el `CHAKRA_PLUGIN_ID` a tu `.env`
2. Reinicia el bot: `npm start`
3. Envía un mensaje de prueba
4. El bot debería responder correctamente

---

¿Tienes el Plugin ID? Agrégalo al `.env` y reinicia el bot.
