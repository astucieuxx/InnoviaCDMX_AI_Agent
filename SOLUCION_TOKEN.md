# 🔧 Solución: Error de Token de WhatsApp

## El Problema
Error: `Invalid OAuth access token - Cannot parse access token`

Esto significa que tu `WHATSAPP_TOKEN` está:
- ❌ Expirado (si es temporal, solo dura 24 horas)
- ❌ Mal formado
- ❌ Sin los permisos correctos
- ❌ De una app diferente

---

## ✅ Solución: Obtener un Token Válido

### Opción 1: Token Temporal (Para Pruebas Rápidas)

1. Ve a: **https://developers.facebook.com/**
2. Selecciona tu aplicación
3. Ve a **"WhatsApp"** → **"Configuración"** → **"API Setup"**
4. Busca la sección **"Temporary access token"**
5. Haz clic en **"Generate token"** o **"Copy"**
6. **⚠️ IMPORTANTE**: Este token solo dura **24 horas**

### Opción 2: Token Permanente (Recomendado)

#### Paso 1: Obtener Token de Acceso del Sistema

1. Ve a: **https://developers.facebook.com/**
2. Selecciona tu aplicación
3. En el menú lateral, ve a **"Sistema"** → **"Tokens de acceso"**
4. O ve directamente a: **https://developers.facebook.com/tools/explorer/**

#### Paso 2: Usar Graph API Explorer

1. Ve a: **https://developers.facebook.com/tools/explorer/**
2. En la parte superior:
   - **Selecciona tu aplicación** en el dropdown
   - Haz clic en **"Generate Access Token"**
3. Selecciona los permisos necesarios:
   - ✅ `whatsapp_business_messaging`
   - ✅ `whatsapp_business_management`
   - ✅ `whatsapp_business_management.read`
4. Haz clic en **"Generate Access Token"**
5. **Copia el token generado**

#### Paso 3: Convertir a Token Permanente

1. En la misma página de Graph API Explorer
2. Con el token generado, haz clic en el ícono de **"i"** (información) junto al token
3. O ve a: **"Sistema"** → **"Tokens de acceso"** en tu app
4. Busca tu token y haz clic en **"Renovar"** o **"Extender"**
5. Si no hay opción de extender, necesitas crear un token de larga duración:

**Para crear token de larga duración:**

1. Ve a: **https://developers.facebook.com/tools/accesstoken/**
2. Selecciona tu aplicación
3. Busca el token de WhatsApp
4. Haz clic en **"Extend Access Token"** o **"Renovar"**
5. O crea uno nuevo con permisos de larga duración

---

## 🔍 Verificar que el Token Funciona

### Método 1: Probar con cURL

```bash
curl -X GET "https://graph.instagram.com/v18.0/YOUR_PHONE_NUMBER_ID?access_token=YOUR_TOKEN"
```

Reemplaza:
- `YOUR_PHONE_NUMBER_ID` con tu `PHONE_NUMBER_ID`
- `YOUR_TOKEN` con tu `WHATSAPP_TOKEN`

Si funciona, deberías ver información del número de teléfono.

### Método 2: Usar Graph API Explorer

1. Ve a: **https://developers.facebook.com/tools/explorer/**
2. Pega tu token en el campo "Access Token"
3. Prueba esta query:
   ```
   GET /v18.0/YOUR_PHONE_NUMBER_ID
   ```
4. Si ves datos, el token funciona ✅

---

## 📝 Actualizar el .env

Una vez que tengas el token correcto:

1. Abre tu archivo `.env`
2. Actualiza la línea:
   ```env
   WHATSAPP_TOKEN=tu_nuevo_token_aqui
   ```
3. **NO dejes espacios** antes o después del `=`
4. **NO uses comillas** alrededor del token
5. Guarda el archivo

### Ejemplo correcto:
```env
WHATSAPP_TOKEN=EAANgEcZCVPl8BQlJRFfhWhcXcaWYh7l4TsTPrDXzlliA5i4MkFacQBPLTMFrLpge2CEfTIKT0KSbocC4ZAoRArvdjHaZC7FFjoBMLvrfwgzTEfHtNsbZA0NXRn4kb3oI7MRHgckiT53LldBZAlsAF4DIFpN5wjWV04IzKjOWSpxELMePiJBlGmL8i1Gi2EwZDZD
```

### Ejemplo incorrecto:
```env
WHATSAPP_TOKEN="EAANgEcZCVPl8..."  ❌ (con comillas)
WHATSAPP_TOKEN = EAANgEcZCVPl8...  ❌ (con espacios)
```

---

## 🔄 Reiniciar el Bot

Después de actualizar el `.env`:

1. Detén el bot (Ctrl+C en la terminal)
2. Reinicia:
   ```bash
   npm start
   ```

---

## ⚠️ Problemas Comunes

### "Token expirado después de 24 horas"
- **Solución**: Crea un token permanente siguiendo la Opción 2

### "Token sin permisos"
- **Solución**: Asegúrate de tener estos permisos:
  - `whatsapp_business_messaging`
  - `whatsapp_business_management`

### "No puedo generar token permanente"
- **Solución**: 
  1. Verifica que tu app esté en modo "Desarrollo" o "Producción"
  2. Asegúrate de tener un número de teléfono verificado
  3. Puede requerir verificación de la app de Meta

### "El token funciona en Graph API Explorer pero no en el bot"
- **Solución**: 
  1. Verifica que no haya espacios extra en el `.env`
  2. Asegúrate de que el archivo `.env` esté en la raíz del proyecto
  3. Reinicia el bot después de cambiar el `.env`

---

## 🎯 Checklist Rápido

- [ ] Token generado desde Meta Developer Console
- [ ] Token tiene permisos de WhatsApp
- [ ] Token copiado correctamente (sin espacios)
- [ ] `.env` actualizado con el nuevo token
- [ ] Bot reiniciado después del cambio
- [ ] `PHONE_NUMBER_ID` también está correcto

---

## 📞 Si Aún No Funciona

1. **Verifica el PHONE_NUMBER_ID**:
   - Debe ser el ID del número, no el número de teléfono
   - Lo encuentras en: WhatsApp → Configuración → API Setup

2. **Verifica que la app esté activa**:
   - Ve a tu app en Meta Developer
   - Asegúrate de que esté en modo "Desarrollo" o "Producción"

3. **Revisa los logs**:
   - El error debería mostrar más detalles
   - Busca el `fbtrace_id` en el error para debuggear en Meta

4. **Prueba con un token nuevo**:
   - Genera un token completamente nuevo
   - Asegúrate de copiarlo completo sin cortes

¡Con estos pasos deberías resolver el problema! 🚀
