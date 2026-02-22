# Guía: Desplegar Bot de WhatsApp en Railway

## Paso 1: Obtener Credenciales de Google Calendar

1. Ve a https://console.cloud.google.com/apis/credentials
2. Crea un nuevo proyecto (o usa uno existente)
3. Habilita la API de Google Calendar:
   - Ve a "APIs y servicios" → "Biblioteca"
   - Busca "Google Calendar API"
   - Haz clic en "Habilitar"
4. Crea credenciales:
   - Tipo: Cuenta de servicio
   - Nombre: "WhatsApp-Calendar-Bot"
   - Crea una clave JSON y descárgala como `credentials.json`
5. Comparte tu calendario con el email de la cuenta de servicio

## Paso 2: Obtener Credenciales de WhatsApp Cloud API

1. Ve a https://developers.facebook.com/
2. Crea una aplicación (o usa una existente)
3. Selecciona "WhatsApp" como producto
4. Obtén:
   - **WHATSAPP_TOKEN**: Token de acceso permanente de tu app
   - **PHONE_NUMBER_ID**: ID del número de teléfono de WhatsApp Business
   - **VERIFY_TOKEN**: Crea uno arbitrario (ejemplo: "mi_token_seguro_123")

## Paso 3: Preparar en Railway

### Opción A: Usando Git (Recomendado)

1. Crea una carpeta para tu proyecto:
```bash
mkdir whatsapp-calendar-bot
cd whatsapp-calendar-bot
git init
```

2. Copia los archivos creados:
   - whatsapp-calendar-bot.js
   - package.json
   - .env

3. Crea un archivo `.gitignore`:
```
node_modules/
.env
credentials.json
*.log
```

4. Crea un archivo `Procfile`:
```
web: node whatsapp-calendar-bot.js
```

5. Sube a GitHub:
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### Opción B: Desplegar Directamente en Railway

1. Ve a https://railway.app/
2. Login con GitHub o crea cuenta
3. Haz clic en "New Project"
4. Selecciona "Deploy from GitHub"
5. Conecta tu repositorio

## Paso 4: Configurar Variables de Entorno en Railway

1. En tu proyecto Railway, ve a "Variables"
2. Agrega todas las variables del archivo .env:
   - WHATSAPP_TOKEN
   - PHONE_NUMBER_ID
   - VERIFY_TOKEN
   - CALENDAR_ID
   - GOOGLE_CREDENTIALS_PATH=/app/credentials.json

3. Para las credenciales de Google:
   - Abre el archivo credentials.json descargado
   - Copia TODO el contenido JSON
   - En Railway, crea una variable llamada "GOOGLE_CREDENTIALS"
   - Pega el JSON completo como valor

## Paso 5: Crear Archivo de Credenciales en Railway

Como Railway no puede leer archivos JSON directamente, necesitas modificar el bot para leer desde variables de entorno:

Reemplaza esta línea en el archivo principal:
```javascript
keyFile: process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json',
```

Con esto:
```javascript
credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}'),
```

Y actualiza la configuración de Google Auth:
```javascript
async function initGoogleAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');
  authClient = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
}
```

## Paso 6: Configurar Webhook en WhatsApp

1. En tu aplicación de Meta/Facebook
2. Ve a "WhatsApp" → "Configuración"
3. En "Webhooks", configura:
   - **URL**: https://tu-proyecto-railway.up.railway.app/webhook
   - **Verify Token**: El mismo token que pusiste en variables (VERIFY_TOKEN)

4. Suscríbete a los eventos:
   - messages
   - message_status
   - message_template_status_update

5. Verifica el webhook

## Paso 7: Probar el Bot

### Comando para crear cita manualmente:

```bash
curl -X POST https://tu-proyecto-railway.app/create-appointment \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Juan Pérez",
    "phone": "5218001234567",
    "email": "juan@example.com",
    "date": "2025-02-20",
    "time": "14:00"
  }'
```

### Enviar mensaje a tu número de WhatsApp:
- "hola" → El bot responderá con instrucciones
- "disponible" → Mostrará horarios libres
- "cita" → Iniciará el proceso de agendamiento

## Posibles Errores y Soluciones

### Error: "GOOGLE_CREDENTIALS not found"
- Verifica que copiaste TODO el JSON de credentials.json
- El JSON debe estar en una sola línea sin saltos

### Error: "WHATSAPP_TOKEN invalid"
- Regenera el token en Meta developer console
- Asegúrate que el token tiene permisos de "messages:manage"

### El webhook no se verifica
- Usa el mismo VERIFY_TOKEN en código y en Meta
- La URL debe estar en HTTPS y ser accesible públicamente

### No llegan mensajes
- Verifica el PHONE_NUMBER_ID es correcto
- El número de teléfono debe estar registrado en Meta Business Account
- Comprueba que tu app está verificada

## URLs Útiles

- Dashboard de Railway: https://railway.app/dashboard
- Meta Developer Console: https://developers.facebook.com/docs/whatsapp/cloud-api
- Google Cloud Console: https://console.cloud.google.com/
- Test de webhook: https://webhook.site/ (para debugging)

## Mejoras Futuras

1. Agregar base de datos para guardar historial de citas
2. Enviar recordatorios automáticos 24 horas antes
3. Permitir cancelaciones y reprogramaciones
4. Integrar IA para respuestas más naturales
5. Agregar galería de fotos de vestidos

¡Listo! Tu bot está en línea y funcionando 24/7 sin costo.
