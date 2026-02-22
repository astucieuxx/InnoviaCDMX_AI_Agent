# 🔧 Troubleshooting: Error 404 al Enviar Mensajes con Chakra

## ❌ Error Actual

```
❌ Error al enviar mensaje: Not Found (404)
URL: https://api.chakrahq.com/v1/messages
```

## 🔍 Posibles Causas

### 1. Endpoint Incorrecto

El endpoint puede ser diferente. El código ahora prueba automáticamente:
- `https://api.chakrahq.com/v1/messages`
- `https://api.chakrahq.com/api/v1/messages`
- `https://api.chakrahq.com/messages`
- `https://api.chakrahq.com/v1/whatsapp/messages`

### 2. Formato del Payload Incorrecto

El código prueba 3 formatos diferentes:
- Formato estándar WhatsApp Cloud API
- Con `messaging_product`
- Formato simplificado

### 3. API Key o Permisos

- Verifica que el API Key tenga rol "Chakra Bot"
- Verifica que tenga permisos para enviar mensajes

---

## ✅ Solución: Consultar Documentación de Chakra

**Necesitas verificar en la documentación de Chakra:**

1. **Endpoint correcto para enviar mensajes**
2. **Formato exacto del payload**
3. **Headers requeridos**

### Información que Necesito:

1. **URL del endpoint** para enviar mensajes
   - ¿Es `https://api.chakrahq.com/v1/messages`?
   - ¿O es otro?

2. **Formato del payload**:
   ```json
   {
     "to": "5215521920710",
     "type": "text",
     "text": { "body": "mensaje" }
   }
   ```
   ¿Es este formato o diferente?

3. **Headers requeridos**:
   - ¿Solo `Authorization: Bearer {API_KEY}`?
   - ¿Necesita otros headers?

---

## 🔧 Solución Temporal

El código ahora prueba automáticamente diferentes formatos. Cuando reinicies el bot y envíes un mensaje, verás en los logs:

```
🔍 Intentando enviar a: https://api.chakrahq.com/v1/messages
   Payload: {...}
```

Si todos fallan, verás qué endpoint y payload se intentaron.

---

## 📋 Qué Hacer Ahora

1. **Consulta la documentación de Chakra**:
   - Ve a tu panel de Chakra
   - Busca "API Documentation" o "Developer Docs"
   - O contacta al soporte de Chakra

2. **Comparte conmigo**:
   - El endpoint correcto
   - Un ejemplo del payload
   - Cualquier header adicional requerido

3. **Mientras tanto**, el código probará automáticamente diferentes formatos

---

## 🧪 Prueba Manual

Puedes probar manualmente con curl:

```bash
curl -X POST https://api.chakrahq.com/v1/messages \
  -H "Authorization: Bearer TU_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "5215521920710",
    "type": "text",
    "text": { "body": "Prueba" }
  }'
```

Esto te dirá exactamente qué formato espera Chakra.

---

¿Tienes acceso a la documentación de Chakra? Si puedes compartir el endpoint y formato correcto, lo actualizo inmediatamente.
