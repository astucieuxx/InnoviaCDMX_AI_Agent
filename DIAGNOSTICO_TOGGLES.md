# 🔍 Diagnóstico Completo: Sistema de Toggles (Inactivo, Pruebas, Activo)

## 📋 Resumen Ejecutivo

El bot tiene **3 modos de operación** que controlan completamente su comportamiento:
- **`inactive`**: Bot completamente desactivado - NO responde a NADIE
- **`test`**: Modo de pruebas - Solo responde a `+525521920710`
- **`active`**: Bot activo - Responde a TODOS los números

**Valor por defecto**: `inactive` (por seguridad)

---

## 🗂️ 1. Almacenamiento del Estado

### Archivo: `bot_status.json`
- **Ubicación**: `/app/bot_status.json` (en Railway)
- **Formato**:
  ```json
  {
    "mode": "inactive",
    "updatedAt": "2026-02-25T01:23:28.105Z"
  }
  ```
- **Nota**: El archivo está en `.gitignore`, por lo que NO se sube a Git. Se crea automáticamente en Railway.

### Creación Automática
- Si el archivo **no existe**, se crea automáticamente con valor `'inactive'`
- Esto ocurre la primera vez que se llama a `getBotMode()`
- **Por seguridad**, el valor por defecto es siempre `'inactive'`

---

## 🔄 2. Funciones de Lectura y Escritura

### `getBotMode()` - Leer Estado

**Flujo de lectura:**
1. Lee el archivo `bot_status.json` desde `/app/bot_status.json`
2. Si el archivo existe:
   - Prioriza el campo `mode` sobre `active` (compatibilidad con formato antiguo)
   - Si encuentra formato antiguo (`active: true/false`), lo migra automáticamente
   - Valida que el modo sea uno de: `'inactive'`, `'test'`, `'active'`
   - Retorna el modo válido
3. Si el archivo NO existe:
   - **Crea el archivo automáticamente** con `mode: 'inactive'`
   - Retorna `'inactive'`
4. Si hay error:
   - Retorna `'inactive'` por seguridad

**Valores de retorno:**
- `'inactive'` - Bot inactivo
- `'test'` - Modo de pruebas
- `'active'` - Bot activo
- `'inactive'` - Por defecto si hay error (seguridad)

### `setBotMode(mode)` - Guardar Estado

**Flujo de escritura:**
1. Valida que el modo sea uno de: `'inactive'`, `'test'`, `'active'`
2. Crea el objeto con **solo** el campo `mode` (elimina `active` si existe)
3. Escribe el archivo `bot_status.json`
4. Verifica que se escribió correctamente
5. Si detecta campo `active` residual, lo elimina automáticamente
6. Retorna `true` si fue exitoso, `false` si hubo error

**Características:**
- Solo guarda el campo `mode`, nunca `active`
- Limpia automáticamente campos residuales
- Verifica la escritura antes de confirmar

---

## 🛡️ 3. Puntos de Verificación (Bloqueo)

El bot verifica el estado en **4 lugares críticos**:

### 3.1. Webhook (`app.post('/webhook')`) - PRIMERA LÍNEA DE DEFENSA

**Ubicación**: Línea 1261 - **ANTES** de procesar cualquier mensaje

**Lógica:**
```javascript
1. Lee el modo del bot
2. Si es 'inactive':
   → Responde 200 OK inmediatamente
   → NO procesa el mensaje
   → Termina la función
3. Si es 'test':
   → Extrae el número del remitente del body
   → Compara con +525521920710
   → Si NO coincide:
     → Responde 200 OK inmediatamente
     → NO procesa el mensaje
     → Termina la función
   → Si coincide:
     → Continúa con el procesamiento
4. Si es 'active':
   → Continúa con el procesamiento normal
```

**Resultado**: El mensaje se bloquea **antes** de llegar a cualquier otra función.

### 3.2. `processIncomingMessage()` - SEGUNDA VERIFICACIÓN

**Ubicación**: Línea 1719 - Al inicio de la función

**Lógica:**
```javascript
1. Verifica si es 'inactive':
   → Lanza Error('BOT_INACTIVE_BLOCKED')
   → Termina la función inmediatamente
2. Verifica si es 'test':
   → Compara número con +525521920710
   → Si NO coincide:
     → Lanza Error('BOT_TEST_MODE_BLOCKED')
     → Termina la función inmediatamente
3. Si es 'active':
   → Continúa con el procesamiento normal
```

**Resultado**: Doble verificación - si el mensaje llegó aquí, se bloquea de nuevo.

### 3.3. `sendWhatsAppMessage()` - TERCERA VERIFICACIÓN

**Ubicación**: Línea 1040 - Antes de enviar cualquier mensaje

**Lógica:**
```javascript
1. Verifica si es 'inactive':
   → Retorna { success: false, blocked: true }
   → NO envía el mensaje
2. Verifica si es 'test':
   → Compara número con +525521920710
   → Si NO coincide:
     → Retorna { success: false, blocked: true }
     → NO envía el mensaje
3. Si es 'active':
   → Envía el mensaje normalmente
```

**Resultado**: Aunque el mensaje se procesó, no se envía respuesta si está bloqueado.

### 3.4. `sendTypingIndicator()` - CUARTA VERIFICACIÓN

**Ubicación**: Línea 965 - Antes de enviar typing indicator

**Lógica:**
```javascript
1. Verifica si es 'inactive':
   → Retorna sin hacer nada
   → NO envía typing indicator
2. Verifica si es 'test':
   → Compara número con +525521920710
   → Si NO coincide:
     → Retorna sin hacer nada
     → NO envía typing indicator
3. Si es 'active':
   → Envía typing indicator normalmente
```

**Resultado**: No se muestra "escribiendo..." si está bloqueado.

---

## 🎨 4. Frontend (Dashboard)

### Carga del Estado

**Función**: `loadBotMode()` (línea 1155)

**Flujo:**
1. Hace GET a `/api/bot-mode`
2. Obtiene el modo actual
3. Llama a `updateBotModeUI(mode)` para actualizar la interfaz
4. Si hay error, usa `'active'` por defecto (⚠️ **Nota**: Debería ser `'inactive'`)

### Actualización de UI

**Función**: `updateBotModeUI(mode)` (línea 1167)

**Configuración de modos:**
- **`inactive`**: 
  - Texto: "Bot inactivo - No responderá a ningún mensaje"
  - Color: Rojo (#ff4444)
  - Badge: "INACTIVO"
- **`test`**: 
  - Texto: "Modo de pruebas - Solo responderá a +525521920710"
  - Color: Amarillo (#ffb800)
  - Badge: "PRUEBAS"
- **`active`**: 
  - Texto: "Bot activo - Responderá a todos los números"
  - Color: Verde (#00c853)
  - Badge: "ACTIVO"

### Cambio de Estado

**Función**: `selectBotMode(mode)` (línea 1230)

**Flujo:**
1. Hace PUT a `/api/bot-mode` con el nuevo modo
2. Si es exitoso:
   - Actualiza la UI con `updateBotModeUI(mode)`
   - Muestra mensaje de confirmación
3. Si hay error:
   - Muestra mensaje de error

---

## 🔢 5. Comparación de Números (Modo Test)

### Número de Pruebas Permitido
- **Completo**: `+525521920710`
- **Limpio completo**: `525521920710`
- **Limpio corto**: `5521920710`

### Lógica de Comparación

```javascript
const cleanPhone = senderPhone.replace(/\D/g, ''); // Elimina todo excepto dígitos

// Tres formas de coincidencia:
1. exactMatchFull: cleanPhone === '525521920710'
2. exactMatchShort: cleanPhone === '5521920710'
3. endsWithMatch: cleanPhone.endsWith('5521920710') && length entre 10-12

phoneMatches = exactMatchFull || exactMatchShort || endsWithMatch
```

**Ejemplos que SÍ coinciden:**
- `+525521920710` → `525521920710` ✅
- `525521920710` → `525521920710` ✅
- `5521920710` → `5521920710` ✅
- `15521920710` → `15521920710` → endsWith ✅

**Ejemplos que NO coinciden:**
- `+1234567890` → `1234567890` ❌
- `525521920711` → `525521920711` ❌

---

## 📊 6. Flujo Completo de un Mensaje

### Escenario 1: Bot en Modo `inactive`

```
1. Webhook recibe mensaje
   ↓
2. getBotMode() → 'inactive'
   ↓
3. Webhook verifica → BLOQUEADO
   ↓
4. Responde 200 OK
   ↓
5. ❌ NO se procesa el mensaje
   ❌ NO se llama a processIncomingMessage()
   ❌ NO se envía respuesta
   ❌ NO se guarda en historial
```

### Escenario 2: Bot en Modo `test` - Número Permitido

```
1. Webhook recibe mensaje de +525521920710
   ↓
2. getBotMode() → 'test'
   ↓
3. Webhook verifica número → ✅ PERMITIDO
   ↓
4. processIncomingMessage() se llama
   ↓
5. Verifica modo de nuevo → 'test'
   ↓
6. Verifica número de nuevo → ✅ PERMITIDO
   ↓
7. ✅ Procesa el mensaje normalmente
   ✅ Envía respuesta
   ✅ Guarda en historial
```

### Escenario 3: Bot en Modo `test` - Número NO Permitido

```
1. Webhook recibe mensaje de otro número
   ↓
2. getBotMode() → 'test'
   ↓
3. Webhook verifica número → ❌ NO PERMITIDO
   ↓
4. Responde 200 OK
   ↓
5. ❌ NO se procesa el mensaje
   ❌ NO se llama a processIncomingMessage()
   ❌ NO se envía respuesta
   ❌ NO se guarda en historial
```

### Escenario 4: Bot en Modo `active`

```
1. Webhook recibe mensaje de cualquier número
   ↓
2. getBotMode() → 'active'
   ↓
3. Webhook verifica → ✅ PERMITIDO
   ↓
4. processIncomingMessage() se llama
   ↓
5. Verifica modo de nuevo → 'active'
   ↓
6. ✅ Procesa el mensaje normalmente
   ✅ Envía respuesta
   ✅ Guarda en historial
```

---

## ⚠️ 7. Problemas Conocidos y Soluciones

### Problema 1: Archivo no existe en Railway
**Solución**: ✅ Implementada - Se crea automáticamente con valor `'inactive'`

### Problema 2: Campo `active` residual
**Solución**: ✅ Implementada - Se limpia automáticamente al guardar

### Problema 3: Frontend usa `'active'` por defecto en error
**Ubicación**: `public/app.js` línea 1162
**Estado**: ⚠️ Debería usar `'inactive'` por seguridad
**Impacto**: Bajo - Solo afecta la UI, no el comportamiento del bot

---

## 🔐 8. Seguridad

### Capas de Protección

1. **Webhook** (Primera línea) - Bloquea antes de procesar
2. **processIncomingMessage** (Segunda línea) - Bloquea si llegó aquí
3. **sendWhatsAppMessage** (Tercera línea) - Bloquea antes de enviar
4. **sendTypingIndicator** (Cuarta línea) - Bloquea indicadores

### Valor por Defecto
- **Siempre `'inactive'`** por seguridad
- Si hay error leyendo el archivo → `'inactive'`
- Si el archivo no existe → `'inactive'`
- Si el modo es inválido → `'inactive'`

---

## 📝 9. Endpoints API

### GET `/api/bot-mode`
- Retorna el modo actual del bot
- Usado por el dashboard para cargar el estado

### PUT `/api/bot-mode`
- Cambia el modo del bot
- Valida que el modo sea válido
- Guarda en `bot_status.json`
- Retorna confirmación

### GET `/api/test-mode-diagnostic`
- Endpoint de diagnóstico
- Prueba diferentes formatos del número de prueba
- Muestra qué formatos coinciden

---

## ✅ 10. Resumen de la Lógica Actual

1. **Valor por defecto**: `'inactive'` (por seguridad)
2. **Archivo**: Se crea automáticamente si no existe
3. **Verificaciones**: 4 capas de bloqueo
4. **Modo test**: Solo permite `+525521920710`
5. **Modo inactive**: Bloquea TODO
6. **Modo active**: Permite TODO

---

## 🎯 Conclusión

El sistema está **bien diseñado** con múltiples capas de seguridad. El valor por defecto `'inactive'` asegura que el bot no responda accidentalmente después de un deploy.

**Recomendación**: Cambiar el valor por defecto en el frontend de `'active'` a `'inactive'` en caso de error (línea 1162 de `app.js`).
