# 🚀 Guía de Despliegue a Railway

Esta guía te ayudará a subir el bot a producción en Railway paso a paso.

## 📋 Prerequisitos

1. ✅ Cuenta de GitHub (gratis)
2. ✅ Cuenta de Railway (gratis en https://railway.app)
3. ✅ Todas las credenciales necesarias (Chakra, Google, OpenAI)

## 🔄 Paso 1: Subir a GitHub

### 1.1 Inicializar Git (si no lo has hecho)

```bash
cd /Users/benjaminmiranda/Desktop/Bot_Citas_Scheduler
git init
git add .
git commit -m "Initial commit: Bot de WhatsApp para agendar citas"
```

### 1.2 Crear repositorio en GitHub

1. Ve a https://github.com/new
2. Crea un nuevo repositorio (ej: `bot-citas-innovia`)
3. **NO** inicialices con README, .gitignore o licencia
4. Copia la URL del repositorio (ej: `https://github.com/tu-usuario/bot-citas-innovia.git`)

### 1.3 Conectar y subir

```bash
git remote add origin https://github.com/tu-usuario/bot-citas-innovia.git
git branch -M main
git push -u origin main
```

## 🚂 Paso 2: Configurar Railway

### 2.1 Crear proyecto en Railway

1. Ve a https://railway.app y inicia sesión con GitHub
2. Click en **"New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Elige tu repositorio `bot-citas-innovia`
5. Railway detectará automáticamente el `Procfile` y `package.json`

### 2.2 Configurar Variables de Entorno

En Railway, ve a tu proyecto → **Variables** y agrega todas estas variables:

#### 🔑 Credenciales de Chakra (WhatsApp)
```
CHAKRA_API_KEY=tu_chakra_api_key_aqui
CHAKRA_PLUGIN_ID=tu_plugin_id_aqui
CHAKRA_WHATSAPP_API_VERSION=v18.0
VERIFY_TOKEN=mi_token_seguro_123
```

#### 📅 Credenciales de Google Calendar

**Opción A: Usar cuenta de servicio (Recomendado para producción)**

1. Ve a https://console.cloud.google.com/apis/credentials
2. Crea una **Cuenta de Servicio** (no OAuth)
3. Descarga el JSON
4. Copia **TODO el contenido del JSON** y pégalo en Railway como:

```
GOOGLE_CREDENTIALS={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

**Opción B: Usar OAuth (si ya tienes token.json)**

Si ya tienes un `token.json` funcionando localmente:
1. Copia el contenido completo de `token.json`
2. Pégalo en Railway como:

```
GOOGLE_TOKEN={"access_token":"...","refresh_token":"...","scope":"..."}
```

También necesitarás las credenciales OAuth:
```
GOOGLE_CLIENT_ID=tu_client_id
GOOGLE_CLIENT_SECRET=tu_client_secret
GOOGLE_REDIRECT_URI=https://tu-app.railway.app/oauth2callback
```

#### 🤖 Credenciales de OpenAI
```
OPENAI_API_KEY=tu_openai_api_key_aqui
```

#### ⚙️ Configuración del Servidor
```
PORT=3000
CALENDAR_ID=primary
ADMIN_PHONE=+525521920710
```

### 2.3 Configurar el Webhook de WhatsApp

1. En Railway, ve a tu proyecto → **Settings** → **Networking**
2. Railway te dará una URL pública (ej: `https://tu-app.up.railway.app`)
3. Copia esta URL

4. Ve a tu panel de Chakra:
   - Ve a **Webhooks**
   - Configura el webhook: `https://tu-app.up.railway.app/webhook`
   - Token de verificación: `mi_token_seguro_123` (el mismo que pusiste en Railway)

### 2.4 Configurar Dominio Personalizado (Opcional)

Si quieres un dominio personalizado:
1. Railway → Settings → Networking → Custom Domain
2. Agrega tu dominio
3. Actualiza el webhook en Chakra con la nueva URL

## 🔍 Paso 3: Verificar el Despliegue

### 3.1 Revisar Logs

En Railway → **Deployments** → Click en el último deployment → **View Logs**

Deberías ver:
```
✅ Business config loaded successfully
✅ Autenticación de Google inicializada
✅ Bot de WhatsApp escuchando en puerto 3000
```

### 3.2 Probar el Webhook

1. En Railway → **Settings** → **Networking** → Copia la URL pública
2. Abre en el navegador: `https://tu-app.up.railway.app/`
3. Deberías ver el dashboard

### 3.3 Probar WhatsApp

1. Envía un mensaje a tu número de WhatsApp Business
2. Revisa los logs en Railway para ver si llega el mensaje
3. El bot debería responder

## 🛠️ Paso 4: Configuración Adicional

### 4.1 Google Calendar - Compartir Calendario

Si usas cuenta de servicio:
1. Ve a Google Calendar
2. Crea o selecciona el calendario "CITAS NUEVAS"
3. Configuración del calendario → Compartir con usuarios específicos
4. Agrega el email de la cuenta de servicio (está en el JSON)
5. Dale permisos de **"Hacer cambios en eventos"**

### 4.2 Configurar el Negocio

1. Accede al dashboard: `https://tu-app.up.railway.app/`
2. Ve a la pestaña **"Configuración"**
3. Completa la información del negocio
4. Guarda los cambios

### 4.3 Activar el AI Agent

1. En el dashboard → **"Configuración"**
2. Verifica que el **"AI Agent"** esté activo (botón verde)
3. Si está inactivo, haz clic en **"Activar AI Agent"**

## 📝 Notas Importantes

### Archivos que NO se suben a Git (están en .gitignore):
- `.env` - Variables de entorno
- `credentials.json` - Credenciales de Google
- `token.json` - Token de OAuth
- `bot_status.json` - Estado del bot (se crea automáticamente)

### Archivos que SÍ se suben a Git:
- `bot_messages.json` - Mensajes del bot (editables desde dashboard)
- `business_config.json` - Configuración del negocio
- `package.json` - Dependencias

### Actualizar el Bot

Cada vez que hagas cambios:

```bash
git add .
git commit -m "Descripción de los cambios"
git push origin main
```

Railway detectará automáticamente los cambios y hará un nuevo deploy.

## 🐛 Solución de Problemas

### El bot no responde
1. Revisa los logs en Railway
2. Verifica que todas las variables de entorno estén configuradas
3. Verifica que el webhook esté configurado correctamente en Chakra

### Error de Google Calendar
1. Verifica que `GOOGLE_CREDENTIALS` esté completo y bien formateado
2. Verifica que el calendario esté compartido con la cuenta de servicio
3. Verifica que el `CALENDAR_ID` sea correcto

### Error de autenticación
1. Verifica que todas las API keys estén correctas
2. Revisa los logs para ver el error específico

## ✅ Checklist Final

- [ ] Código subido a GitHub
- [ ] Proyecto creado en Railway
- [ ] Todas las variables de entorno configuradas
- [ ] Webhook configurado en Chakra
- [ ] Calendario compartido con cuenta de servicio
- [ ] Dashboard accesible
- [ ] Bot responde a mensajes
- [ ] AI Agent activado

## 🎉 ¡Listo!

Tu bot está en producción. Puedes monitorear su actividad desde el dashboard en `https://tu-app.up.railway.app/`
