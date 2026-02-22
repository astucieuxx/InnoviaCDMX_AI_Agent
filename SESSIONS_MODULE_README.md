# 📋 Sessions Module - Gestión de Estado de Conversaciones

## ✅ Módulo Creado

Se ha creado el módulo `sessions.js` para gestionar el estado de las conversaciones por número de WhatsApp.

## 📁 Estructura de Sesión

Cada sesión almacena:

```javascript
{
  nombre_novia: string | null,        // Nombre de la novia
  fecha_boda: string | null,          // Fecha de la boda
  etapa: 'primer_contacto' | 'interesada' | 'cita_agendada',  // Etapa de la conversación
  historial: Array<{                  // Historial de mensajes para contexto
    role: 'user' | 'assistant' | 'system',
    content: string,
    timestamp: string
  }>,
  ultima_actividad: string             // Timestamp ISO de última actividad
}
```

## 🔧 Funciones Exportadas

### `getSession(phone)`
Obtiene o crea una sesión para un número de teléfono.

```javascript
const session = sessions.getSession('5215521920710');
// Si no existe, crea una nueva con valores por defecto
// Si existe, actualiza ultima_actividad y la retorna
```

### `updateSession(phone, data)`
Actualiza datos de una sesión.

```javascript
sessions.updateSession('5215521920710', {
  nombre_novia: 'María',
  fecha_boda: '2025-06-15',
  etapa: 'interesada'
});
```

**Validaciones:**
- `etapa` debe ser uno de: `'primer_contacto'`, `'interesada'`, `'cita_agendada'`
- Si se proporciona un valor inválido, se ignora y se muestra un warning

### `clearSession(phone)`
Elimina una sesión.

```javascript
const deleted = sessions.clearSession('5215521920710');
// Retorna true si se eliminó, false si no existía
```

### `addToHistory(phone, role, content)`
Agrega un mensaje al historial de la sesión.

```javascript
sessions.addToHistory('5215521920710', 'user', 'Hola, quiero agendar una cita');
sessions.addToHistory('5215521920710', 'assistant', '¡Hola! Con gusto te ayudo...');
```

**Características:**
- Limita el historial a los últimos 50 mensajes (para evitar problemas de memoria)
- Roles válidos: `'user'`, `'assistant'`, `'system'`
- Agrega timestamp automáticamente

### Funciones Adicionales

#### `getAllSessions()`
Obtiene todas las sesiones activas.

```javascript
const allSessions = sessions.getAllSessions();
// Retorna: [{ phone: '5215521920710', session: {...} }, ...]
```

#### `getSessionCount()`
Obtiene el número de sesiones activas.

```javascript
const count = sessions.getSessionCount();
```

#### `clearAllSessions()`
Elimina todas las sesiones (útil para testing).

```javascript
sessions.clearAllSessions();
```

#### `getOldSessions(hours)`
Obtiene sesiones más antiguas que X horas.

```javascript
const oldSessions = sessions.getOldSessions(24); // Sesiones de más de 24 horas
// Retorna: ['5215521920710', '5215521920711', ...]
```

#### `cleanupOldSessions(hours)`
Limpia sesiones antiguas.

```javascript
const cleaned = sessions.cleanupOldSessions(24);
// Retorna el número de sesiones eliminadas
```

## 🚀 Ejemplo de Uso

```javascript
const sessions = require('./sessions');

// Obtener o crear sesión
const session = sessions.getSession('5215521920710');

// Actualizar información
sessions.updateSession('5215521920710', {
  nombre_novia: 'María',
  fecha_boda: '2025-06-15',
  etapa: 'interesada'
});

// Agregar mensajes al historial
sessions.addToHistory('5215521920710', 'user', 'Hola');
sessions.addToHistory('5215521920710', 'assistant', '¡Hola María!');

// Obtener sesión actualizada
const updatedSession = sessions.getSession('5215521920710');
console.log(updatedSession.historial); // Array con los mensajes

// Limpiar sesión cuando termine la conversación
sessions.clearSession('5215521920710');
```

## 🔄 Integración con el Bot

Para integrar con `whatsapp-calendar-bot.js`, reemplaza el objeto `conversations`:

```javascript
// Antes:
const conversations = {};

// Después:
const sessions = require('./sessions');

// En lugar de:
if (!conversations[cleanPhone]) {
  conversations[cleanPhone] = { step: 0, data: {} };
}

// Usa:
const session = sessions.getSession(cleanPhone);
```

## 💾 Almacenamiento

- **Actual**: Map en memoria (se pierde al reiniciar el servidor)
- **Futuro**: Se puede migrar a Redis para persistencia

## ⚠️ Notas Importantes

1. **Limpieza de números**: Los números se limpian automáticamente (solo dígitos)
2. **Límite de historial**: Máximo 50 mensajes por sesión
3. **Validación de etapas**: Solo acepta valores válidos
4. **Timestamps**: Se actualizan automáticamente en cada operación

## 🧪 Prueba Rápida

```bash
node -e "const s = require('./sessions'); const ses = s.getSession('123'); console.log(ses);"
```

---

**Módulo de sesiones listo para usar!** 🎉
