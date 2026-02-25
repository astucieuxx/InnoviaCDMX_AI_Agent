# 🔍 Diagnóstico: Webhook No Recibe Mensajes

## ❌ Problema Actual

**Síntoma**: No aparecen logs cuando envías mensajes, incluso con el bot en modo "active".

**Causa**: Chakra **NO está enviando mensajes** al webhook del servidor.

**Evidencia**:
- ✅ El servidor funciona (los cambios de estado se guardan)
- ✅ El código está correcto (hay logging detallado)
- ❌ No aparecen logs `🌐 WEBHOOK POST RECIBIDO` cuando envías mensajes
- ❌ Chakra no está llamando al endpoint `/webhook`

---

## 🔧 Solución: Configurar Webhook en Chakra

### Paso 1: Obtener la URL del Webhook

1. Ve a tu servidor en Railway
2. Obtén la URL pública (ej: `https://tu-app.up.railway.app`)
3. La URL del webhook será: `https://tu-app.up.railway.app/webhook`

**Verificación rápida:**
- Visita: `https://tu-app.up.railway.app/api/webhook-test`
- Deberías ver la URL exacta del webhook

### Paso 2: Configurar Webhook en Chakra

**IMPORTANTE**: Chakra necesita que configures el webhook en su panel. Los pasos exactos dependen de la versión de Chakra que uses.

#### Opción A: Panel Web de Chakra

1. **Accede al panel de Chakra**
   - URL: https://chakrahq.com o tu panel personalizado
   - Inicia sesión con tus credenciales

2. **Busca la sección de Webhooks**
   - Puede estar en: "Configuración" → "Webhooks"
   - O en: "WhatsApp Setup" → "Webhooks"
   - O en: "Integraciones" → "Webhooks"

3. **Configura el webhook:**
   - **URL**: `https://tu-app.up.railway.app/webhook`
   - **Método**: `POST`
   - **Eventos**: Suscríbete a `messages` (mensajes entrantes)

4. **Verifica el webhook:**
   - Chakra puede hacer un GET a `/webhook` para verificar
   - Asegúrate de que `VERIFY_TOKEN` esté configurado en Railway

#### Opción B: API de Chakra

Si Chakra tiene una API para configurar webhooks:

```bash
curl -X POST https://api.chakrahq.com/v1/webhooks \
  -H "Authorization: Bearer TU_CHAKRA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://tu-app.up.railway.app/webhook",
    "events": ["messages"],
    "method": "POST"
  }'
```

### Paso 3: Verificar que el Webhook Está Configurado

1. **Prueba manualmente el webhook:**
   ```bash
   curl -X POST https://tu-app.up.railway.app/api/webhook-test \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   ```
   
   Deberías ver logs en Railway: `🧪 WEBHOOK TEST - POST RECIBIDO`

2. **Verifica que Chakra puede acceder:**
   - El webhook debe ser accesible públicamente (HTTPS)
   - No debe requerir autenticación (o Chakra debe tener las credenciales)

3. **Revisa los logs de Chakra:**
   - Si Chakra tiene logs, verifica que está intentando enviar mensajes
   - Busca errores de conectividad o autenticación

---

## 🧪 Pruebas de Diagnóstico

### Test 1: Verificar que el Servidor Está Accesible

```bash
curl https://tu-app.up.railway.app/
```

**Resultado esperado:**
```json
{
  "status": "ok",
  "message": "Bot de WhatsApp funcionando",
  "botMode": "active",
  ...
}
```

### Test 2: Verificar el Endpoint del Webhook

```bash
curl https://tu-app.up.railway.app/api/webhook-test
```

**Resultado esperado:**
```json
{
  "status": "ok",
  "message": "Webhook endpoint está accesible",
  "instructions": {
    "webhookUrl": "https://tu-app.up.railway.app/webhook",
    ...
  }
}
```

### Test 3: Probar el Webhook Manualmente

```bash
curl -X POST https://tu-app.up.railway.app/api/webhook-test \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

**Resultado esperado:**
- Deberías ver logs en Railway: `🧪 WEBHOOK TEST - POST RECIBIDO`
- La respuesta debería ser: `{"status": "ok", "message": "Webhook test recibido correctamente", ...}`

### Test 4: Verificar el Webhook Real

```bash
curl -X POST https://tu-app.up.railway.app/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "5521920710",
            "text": {"body": "test"}
          }]
        }
      }]
    }]
  }'
```

**Resultado esperado:**
- Deberías ver logs en Railway: `🌐 WEBHOOK POST RECIBIDO`
- El bot debería procesar el mensaje (si está en modo "active" o "test" con número permitido)

---

## 🔍 Verificación del Webhook en Chakra

### Checklist de Configuración

- [ ] Webhook configurado en Chakra con la URL correcta
- [ ] URL es HTTPS (no HTTP)
- [ ] URL es accesible públicamente (no localhost)
- [ ] Método es POST
- [ ] Suscrito a eventos de "messages"
- [ ] VERIFY_TOKEN configurado en Railway (si Chakra lo requiere)
- [ ] Chakra puede acceder al webhook (sin errores de conectividad)

### Verificar en los Logs de Railway

Cuando envíes un mensaje, deberías ver:

1. **Si el webhook está configurado correctamente:**
   ```
   🌐 WEBHOOK POST RECIBIDO - PRIMERA LÍNEA
   🌐 Timestamp: ...
   🌐 Method: POST
   🌐 Body: ...
   ```

2. **Si el bot está en modo "active":**
   ```
   🚨 WEBHOOK RECIBIDO - INICIO
   📨 MENSAJE DE TEXTO RECIBIDO EN WEBHOOK
   ...
   ```

3. **Si el bot está en modo "test":**
   ```
   🧪 MODO DE PRUEBAS - VERIFICACIÓN EN WEBHOOK
   🧪 Número recibido: ...
   🧪 ✅ PERMITIDO - Es el número de pruebas
   ...
   ```

4. **Si el bot está en modo "inactive":**
   ```
   ⏸️  BOT INACTIVO - WEBHOOK BLOQUEADO INMEDIATAMENTE
   ```

---

## 🚨 Problemas Comunes

### Problema 1: No Aparecen Logs del Webhook

**Causa**: Chakra no está enviando mensajes al webhook.

**Solución**:
1. Verifica que el webhook está configurado en Chakra
2. Verifica que la URL es correcta y accesible
3. Verifica que Chakra tiene permisos para enviar al webhook
4. Revisa los logs de Chakra para ver si hay errores

### Problema 2: Webhook Retorna 404

**Causa**: La URL del webhook es incorrecta.

**Solución**:
1. Verifica la URL exacta: `https://tu-app.up.railway.app/webhook`
2. Prueba la URL manualmente con curl
3. Verifica que el servidor está funcionando

### Problema 3: Webhook Retorna 401/403

**Causa**: El webhook requiere autenticación que Chakra no tiene.

**Solución**:
1. Verifica que el webhook no requiere autenticación
2. Si requiere, configura las credenciales en Chakra
3. O remueve la autenticación del webhook

### Problema 4: Chakra No Puede Acceder al Webhook

**Causa**: Problemas de conectividad o firewall.

**Solución**:
1. Verifica que Railway permite conexiones entrantes
2. Verifica que no hay firewall bloqueando
3. Prueba la URL desde otro lugar (ej: webhook.site)

---

## 📞 Próximos Pasos

1. **Configura el webhook en Chakra** siguiendo los pasos arriba
2. **Prueba enviando un mensaje** desde WhatsApp
3. **Revisa los logs en Railway** para ver si aparecen los logs del webhook
4. **Si aún no funciona**, comparte:
   - Los logs de Railway cuando envías un mensaje
   - La configuración del webhook en Chakra (sin credenciales)
   - Cualquier error que aparezca en Chakra

---

## ✅ Verificación Final

Una vez configurado correctamente, cuando envíes un mensaje deberías ver:

```
🌐 WEBHOOK POST RECIBIDO - PRIMERA LÍNEA
🌐 Timestamp: 2026-02-25T...
🌐 Method: POST
🌐 Body: {...}
🚨 WEBHOOK RECIBIDO - INICIO
📨 MENSAJE DE TEXTO RECIBIDO EN WEBHOOK
📨 De: 5521920710
📨 Mensaje: hola
...
```

Si ves estos logs, el webhook está funcionando correctamente. 🎉
