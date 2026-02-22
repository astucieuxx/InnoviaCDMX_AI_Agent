# 🤖 Bot de WhatsApp para Agendar Citas

Bot automatizado que agenda citas en Google Calendar a través de WhatsApp. **100% gratis** con Railway.

> **Nota**: La configuración del negocio (nombre, mensajes, horarios, etc.) se encuentra en `business_config.json`. Todos los módulos deben importar esta configuración desde `config.js`, nunca hardcodear información del negocio directamente.

## ✨ Características

- ✅ Recibe mensajes en WhatsApp automáticamente
- 📅 Consulta disponibilidad en Google Calendar
- 🎯 Crea citas automáticamente
- 📬 Envía confirmaciones por WhatsApp
- 🔄 Funciona 24/7 sin costo
- 🚀 Desplegado en Railway (hosting gratis)

## 🚀 Inicio Rápido

### Lo que necesitas (5 minutos)

1. **Cuenta de Meta/Facebook** (gratis)
2. **Google Account** (para Google Calendar)
3. **Cuenta en Railway** (gratis, con GitHub)
4. **Número de WhatsApp Business** (puedes usar el personal)

### Pasos para Configurar

#### 1️⃣ Descarga los Archivos

```bash
git clone <tu_repo>
cd whatsapp-calendar-bot
```

O descarga manualmente:
- `whatsapp-calendar-bot.js`
- `package.json`
- `.env`

#### 2️⃣ Obtén Credenciales de Google

1. Ve a https://console.cloud.google.com/apis/credentials
2. Nuevo Proyecto → "WhatsApp Calendar Bot"
3. Habilita Google Calendar API
4. Crea cuenta de servicio:
   - Tipo: Cuenta de servicio
   - Dale un nombre
   - Descarga JSON
5. **Copia TODO el contenido del JSON** (lo necesitarás luego)

#### 3️⃣ Obtén Credenciales de WhatsApp

1. Ve a https://developers.facebook.com/
2. Mi aplicación → Crear aplicación
3. Selecciona "Empresa" y agrega WhatsApp
4. En Configuración → Token de acceso
5. Genera un token permanente
6. Copia:
   - **Token**
   - **Número de teléfono ID**

#### 4️⃣ Sube a GitHub

```bash
git init
git add .
git commit -m "Initial"
git push origin main
```

#### 5️⃣ Despliega en Railway

1. Ve a https://railway.app/
2. Login con GitHub
3. Nuevo Proyecto → Deploy desde GitHub
4. Selecciona tu repositorio
5. Espera a que instale

#### 6️⃣ Configura Variables de Entorno

En Railway, ve a "Variables" y agrega:

```
WHATSAPP_TOKEN=tu_token_aqui
PHONE_NUMBER_ID=tu_numero_id_aqui
VERIFY_TOKEN=mi_token_seguro_123
CALENDAR_ID=tu_email_de_calendario@group.calendar.google.com
GOOGLE_CREDENTIALS={"type": "service_account", ...} // TODO el JSON aquí
```

Para `GOOGLE_CREDENTIALS`: 
- Abre el JSON de Google descargado
- Cópialo completo
- Pégalo como valor

#### 7️⃣ Configura el Webhook en Meta

1. Ve a tu app de Meta → WhatsApp → Configuración
2. Webhooks:
   - **URL**: `https://tu-app-railway.up.railway.app/webhook`
   - **Verify Token**: El mismo que pusiste en Railway (`mi_token_seguro_123`)
3. Suscríbete a: `messages`

#### 8️⃣ Prueba!

Envía un mensaje a tu número:
- "hola" → Debería responder
- "disponible" → Muestra horarios libres
- "cita" → Inicia agendamiento

## 💬 Cómo Funciona

```
Cliente: "Hola, quiero agendar cita"
Bot: "¡Bienvenida! Escribe tu nombre, email y fecha preferida"

Cliente: "Juan Pérez, juan@email.com, 2025-02-20"
Bot: "📅 Horarios disponibles:
      1. 10:00
      2. 14:00
      3. 16:00"

Cliente: "2"
Bot: "✅ Cita confirmada para 14:00 el 2025-02-20"
     [Evento creado en Google Calendar]
     [Recordatorio configurado]
```

## 🛠️ API Endpoints

### POST /webhook
Recibe mensajes de WhatsApp (automático)

### GET /webhook
Verifica el webhook (automático)

### POST /create-appointment
Crea una cita manualmente

```bash
curl -X POST https://tu-app.up.railway.app/create-appointment \
  -H "Content-Type: application/json" \
  -d '{
    "name": "María García",
    "phone": "5218001234567",
    "email": "maria@example.com",
    "date": "2025-02-20",
    "time": "15:00"
  }'
```

### GET /health
Verifica si el bot está funcionando

## 🎛️ Interfaz de Administración

El bot incluye una **interfaz web completa** para administrar y monitorear el bot:

### Acceso
Simplemente visita la URL de tu aplicación (ej: `https://tu-app.up.railway.app/`) en tu navegador.

### Características

#### 📊 Dashboard
- Estadísticas en tiempo real:
  - Total de mensajes (entrantes y salientes)
  - Número de conversaciones activas
  - Citas agendadas
  - Actividad del día
- Vista de mensajes recientes
- Actualización automática cada 5 segundos

#### 💬 Conversaciones
- Lista de todas las conversaciones
- Vista detallada de cada conversación
- Historial completo de mensajes
- Búsqueda por número de teléfono

#### ⚙️ Prompts Configurables
Edita los mensajes que el bot envía:
- **Mensaje de Bienvenida**: Se envía cuando el cliente escribe "hola" o "cita"
- **Respuesta por Defecto**: Cuando el bot no entiende el mensaje
- **Confirmación de Cita**: Mensaje cuando se confirma una cita (usa `{date}` y `{time}` como variables)
- **Encabezado/Pie de Horarios**: Texto antes y después de mostrar horarios disponibles

Los cambios se aplican **inmediatamente** sin reiniciar el bot.

#### 📅 Citas
- Lista de todas las citas agendadas
- Información del cliente (nombre, teléfono, email)
- Fecha y hora de la cita
- Enlace directo a Google Calendar

### API de Administración

#### GET /api/stats
Obtiene estadísticas del bot

#### GET /api/messages?limit=100&phone=1234567890
Obtiene mensajes (opcionalmente filtrados por teléfono)

#### GET /api/conversations
Obtiene lista de conversaciones

#### GET /api/conversations/:phone
Obtiene mensajes de una conversación específica

#### GET /api/appointments?limit=50
Obtiene citas agendadas

#### GET /api/prompts
Obtiene los prompts actuales del bot

#### PUT /api/prompts
Actualiza los prompts del bot

```bash
curl -X PUT https://tu-app.up.railway.app/api/prompts \
  -H "Content-Type: application/json" \
  -d '{
    "prompts": {
      "greeting": "Tu nuevo mensaje de bienvenida",
      "defaultResponse": "Tu nueva respuesta por defecto"
    }
  }'
```

## 📝 Variables Requeridas

| Variable | Descripción | Dónde Obtenerla |
|----------|------------|-----------------|
| WHATSAPP_TOKEN | Token de tu app | Meta Developer Console |
| PHONE_NUMBER_ID | ID del número de teléfono | Meta Business Manager |
| VERIFY_TOKEN | Token de seguridad | Crea uno arbitrario |
| CALENDAR_ID | Email del calendario | Google Calendar Configuración |
| GOOGLE_CREDENTIALS | JSON de credenciales | Google Cloud Console |

## 🐛 Troubleshooting

### "Webhook failed verification"
- Verifica que VERIFY_TOKEN es igual en código y Meta
- URL debe ser HTTPS

### "No hay mensajes entrantes"
- El número debe estar en WhatsApp Business
- Revisa que el webhook está habilitado en Meta

### "Error de Google Calendar"
- Comprueba que el JSON de credenciales es válido
- La cuenta de servicio debe tener acceso al calendario

### "GOOGLE_CREDENTIALS parse error"
- Asegúrate que el JSON está en UNA sola línea
- Sin espacios al inicio ni final

## 🆓 Costos

- **Railway**: Gratis (5 GB/mes de almacenamiento)
- **Google**: Gratis (hasta 10,000 llamadas/día)
- **WhatsApp**: Gratis para primeros 1,000 mensajes/mes
- **Total**: 0 pesos 💰

## 📈 Próximas Mejoras

- [ ] Agregar recordatorios automáticos
- [ ] Base de datos para historial
- [ ] Soporte para múltiples calendarios
- [ ] Galería de fotos
- [ ] Chatbot con IA (OpenAI)
- [ ] Multiidioma

## 🆘 Soporte

Si tienes problemas:

1. Revisa los logs en Railway Dashboard
2. Verifica todas las variables de entorno
3. Prueba el webhook en https://webhook.site/
4. Consulta documentación de Meta: https://developers.facebook.com/docs/whatsapp

## 📄 Licencia

MIT - Usa libremente

---

**¡Hecho con ❤️ para automatizar agendamiento de citas!**

¿Necesitas ayuda? Contacta a soporte o crea un issue en GitHub.
