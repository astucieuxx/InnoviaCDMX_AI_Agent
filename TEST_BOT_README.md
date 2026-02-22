# 🧪 Test Bot Script

## 📋 Descripción

Script de prueba para simular conversaciones del bot sin necesidad de WhatsApp. Útil para:
- Probar respuestas de OpenAI
- Verificar que el system prompt funciona correctamente
- Validar la extracción de datos (nombre_novia, fecha_boda)
- Probar diferentes escenarios de conversación

## 🚀 Uso

### Opción 1: Usando npm script

```bash
npm test
```

### Opción 2: Ejecutar directamente

```bash
node test-bot.js
```

## ⚙️ Requisitos

1. **OPENAI_API_KEY** configurado en `.env`:
   ```env
   OPENAI_API_KEY=sk-tu-api-key-aqui
   ```

2. **Dependencias instaladas**:
   ```bash
   npm install
   ```

## 📊 Escenarios de Prueba

El script prueba 5 escenarios diferentes:

### 1. INFO GENERAL
- Mensaje: "Hola, quiero información sobre sus vestidos"
- Verifica: Respuesta de bienvenida, información del negocio

### 2. PRECIOS
- Mensajes:
  - "Hola"
  - "¿Cuánto cuestan los vestidos?"
- Verifica: Información de precios, redirección a agendar cita

### 3. CATÁLOGO
- Mensajes:
  - "Hola"
  - "¿Tienen catálogo?"
- Verifica: Compartir link del catálogo, invitación a agendar

### 4. AGENDAR CITA
- Mensajes:
  - "Hola"
  - "Me llamo María González"
  - "Mi boda es el 15 de junio de 2025"
  - "Quiero agendar una cita"
- Verifica: 
  - Extracción de nombre_novia: "María González"
  - Extracción de fecha_boda: "2025-06-15" (o formato similar)
  - Actualización de etapa a "interesada"
  - Flujo de agendamiento

### 5. UBICACIÓN
- Mensajes:
  - "Hola"
  - "¿Dónde están ubicados?"
- Verifica: Información de dirección, horarios, invitación a agendar

## 📝 Salida del Script

Para cada escenario, el script muestra:

1. **Mensaje del usuario**
2. **Respuesta del bot** (de OpenAI)
3. **Datos extraídos** (si hay nombre_novia o fecha_boda)
4. **Estado de sesión** (etapa, nombre_novia, fecha_boda, número de mensajes)

Ejemplo de salida:

```
🧪 ESCENARIO: AGENDAR CITA
============================================================

[Usuario 1]: Hola
------------------------------------------------------------
🤖 Llamando a OpenAI con 2 mensajes en contexto
✅ Respuesta de OpenAI recibida (245 caracteres)
[Bot]: ¡Hola! 👰‍♀️ Qué emoción tenerte por aquí 💫 Soy Shao de Innovia CDMX...

📊 Datos extraídos: { nombre_novia: null, fecha_boda: null }

📝 Estado de sesión: {
  etapa: 'primer_contacto',
  nombre_novia: null,
  fecha_boda: null,
  mensajes_en_historial: 2
}

[Usuario 2]: Me llamo María González
------------------------------------------------------------
...
📊 Datos extraídos: { nombre_novia: 'María González', fecha_boda: null }
📝 Estado de sesión: {
  etapa: 'primer_contacto',
  nombre_novia: 'María González',
  fecha_boda: null,
  mensajes_en_historial: 4
}
```

## 🔧 Personalizar Pruebas

Puedes modificar `test-bot.js` para agregar más escenarios o cambiar los mensajes:

```javascript
// Agregar nuevo escenario
await simulateConversation('MI ESCENARIO', [
  'Mensaje 1',
  'Mensaje 2',
  'Mensaje 3'
]);
```

## ⚠️ Notas

- El script usa un número de teléfono de prueba: `5215521920710`
- Cada escenario limpia la sesión antes de empezar
- Hay un delay de 500ms entre mensajes para evitar rate limits
- Los datos extraídos se muestran solo si se encontraron valores

## 🐛 Troubleshooting

### "OPENAI_API_KEY no está configurado"
- Verifica que el archivo `.env` existe y tiene `OPENAI_API_KEY`
- Reinicia después de agregar la variable

### "Cannot find module 'openai'"
- Ejecuta: `npm install`

### Respuestas muy lentas
- Normal, OpenAI puede tardar 2-5 segundos por mensaje
- El script muestra el progreso en tiempo real

---

**¡Listo para probar!** 🎉
