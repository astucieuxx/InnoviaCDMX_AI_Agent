# 📋 Business Configuration Module

## ✅ Implementación Completada

Se ha creado un sistema centralizado de configuración de negocio para evitar hardcodear información del negocio directamente en el código.

## 📁 Archivos Creados/Modificados

### 1. `config.js` (NUEVO)
Módulo que lee y exporta la configuración de negocio desde `business_config.json`.

**Funciones principales:**
- `getBusinessName()` - Nombre del negocio
- `getBusinessAddress()` - Dirección
- `getDefaultGreeting()` - Mensaje de bienvenida
- `getDefaultResponse()` - Respuesta por defecto
- `getAppointmentConfirmationMessage()` - Mensaje de confirmación de cita
- `getResponseTemplate()` - Obtener plantillas con variables
- Y muchas más funciones helper...

### 2. `business_config.json` (YA EXISTÍA)
Archivo JSON con toda la configuración del negocio:
- Información del negocio (nombre, dirección, etc.)
- Horarios
- Catálogo
- Precios
- Información de pagos
- Plantillas de respuesta
- Flujo de conversación

### 3. `whatsapp-calendar-bot.js` (MODIFICADO)
Actualizado para importar y usar la configuración desde `config.js` en lugar de valores hardcodeados.

**Cambios realizados:**
- ✅ Importa funciones de `config.js`
- ✅ Usa `getDefaultGreeting()` en lugar de mensaje hardcodeado
- ✅ Usa `getDefaultResponse()` en lugar de respuesta hardcodeada
- ✅ Usa `getAppointmentConfirmationMessage()` para confirmaciones
- ✅ Usa `getBusinessName()` en eventos de Google Calendar

### 4. `.gitignore` (MODIFICADO)
Actualizado para permitir que `business_config.json` sea rastreado en git (no es información sensible).

## 🚀 Cómo Usar

### Importar en cualquier módulo:

```javascript
const {
  getBusinessName,
  getBusinessAddress,
  getDefaultGreeting,
  getResponseTemplate
} = require('./config');

// Usar las funciones
const greeting = getDefaultGreeting();
const businessName = getBusinessName();
```

### Ejemplo de uso con plantillas:

```javascript
const { getResponseTemplate } = require('./config');

// Obtener plantilla con variables
const message = getResponseTemplate('catalogo', {
  nombre_novia: 'María'
});
```

## 📝 Beneficios

1. **Centralización**: Toda la información del negocio está en un solo lugar
2. **Mantenibilidad**: Cambios en la configuración no requieren modificar código
3. **Reutilización**: Cualquier módulo puede acceder a la configuración
4. **Flexibilidad**: Fácil cambiar mensajes, horarios, precios, etc. sin tocar código
5. **Versionado**: `business_config.json` está en git, permitiendo rastrear cambios

## ⚠️ Regla Importante

**NUNCA hardcodear información del negocio directamente en el código.**

Siempre importar desde `config.js`:

```javascript
// ❌ MAL
const message = '¡Hola! Bienvenida a nuestra boutique';

// ✅ BIEN
const { getDefaultGreeting } = require('./config');
const message = getDefaultGreeting();
```

## 🔄 Próximos Pasos

Si necesitas agregar nueva información de negocio:

1. Agrega la información a `business_config.json`
2. Crea una función helper en `config.js` si es necesario
3. Importa y usa la función en el módulo que la necesite

---

**¡Configuración centralizada implementada exitosamente!** 🎉
