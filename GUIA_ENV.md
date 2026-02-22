# 📋 Guía Completa: Cómo Obtener las Credenciales para el .env

Esta guía te ayudará paso a paso a obtener todas las credenciales necesarias para configurar tu bot.

---

## 🔴 PASO 1: Credenciales de Google Calendar

### 1.1 Crear Proyecto en Google Cloud

1. Ve a: **https://console.cloud.google.com/**
2. Inicia sesión con tu cuenta de Google
3. Haz clic en el selector de proyectos (arriba a la izquierda)
4. Haz clic en **"NUEVO PROYECTO"**
5. Nombre del proyecto: `WhatsApp-Calendar-Bot` (o el que prefieras)
6. Haz clic en **"Crear"**
7. Espera unos segundos y selecciona el proyecto recién creado

### 1.2 Habilitar Google Calendar API

1. En el menú lateral, ve a **"APIs y servicios"** → **"Biblioteca"**
2. Busca: **"Google Calendar API"**
3. Haz clic en el resultado
4. Haz clic en **"HABILITAR"**
5. Espera a que se habilite (puede tardar unos segundos)

### 1.3 Crear Cuenta de Servicio

1. Ve a **"APIs y servicios"** → **"Credenciales"**
2. Haz clic en **"CREAR CREDENCIALES"** (arriba)
3. Selecciona **"Cuenta de servicio"**
4. Completa:
   - **Nombre**: `whatsapp-bot-service`
   - **ID**: Se genera automáticamente
   - Haz clic en **"Crear y continuar"**
5. En "Otorgar acceso a este proyecto":
   - **Rol**: Selecciona **"Editor"** o **"Propietario"**
   - Haz clic en **"Continuar"**
6. Haz clic en **"Listo"** (puedes saltar el paso de usuarios)

### 1.4 Descargar Credenciales JSON

1. En la lista de cuentas de servicio, busca la que acabas de crear
2. Haz clic en el **email de la cuenta** (termina en `@...iam.gserviceaccount.com`)
3. Ve a la pestaña **"CLAVES"**
4. Haz clic en **"Agregar clave"** → **"Crear nueva clave"**
5. Selecciona **"JSON"**
6. Haz clic en **"Crear"**
7. Se descargará un archivo JSON automáticamente
8. **Renombra este archivo a `credentials.json`**
9. **Muévelo a la carpeta de tu proyecto** (`/Users/benjaminmiranda/Desktop/Bot_Citas_Scheduler/`)

### 1.5 Compartir Calendario con la Cuenta de Servicio

1. Abre **Google Calendar** en tu navegador: https://calendar.google.com
2. A la izquierda, haz clic en los **3 puntos** junto a "Mi calendario"
3. Selecciona **"Configuración y uso compartido"**
4. En "Compartir con personas específicas", haz clic en **"Agregar personas"**
5. Pega el **email de la cuenta de servicio** (el que termina en `@...iam.gserviceaccount.com`)
6. Selecciona el permiso: **"Hacer cambios en los eventos"**
7. Haz clic en **"Enviar"**

**✅ Listo para Google Calendar!** Ahora tienes:
- Archivo `credentials.json` en tu carpeta
- Calendario compartido con la cuenta de servicio

---

## 🟢 PASO 2: Credenciales de WhatsApp (Meta/Facebook)

### 2.1 Crear Aplicación en Meta

1. Ve a: **https://developers.facebook.com/**
2. Inicia sesión con tu cuenta de Facebook/Meta
3. Haz clic en **"Mis aplicaciones"** (arriba a la derecha)
4. Haz clic en **"Crear aplicación"**
5. Selecciona **"Empresa"** como tipo
6. Haz clic en **"Siguiente"**
7. Completa:
   - **Nombre de la aplicación**: `Bot Citas WhatsApp` (o el que prefieras)
   - **Email de contacto**: Tu email
8. Haz clic en **"Crear aplicación"**
9. Completa la verificación de seguridad si te la pide

### 2.2 Agregar WhatsApp al Proyecto

1. En el dashboard de tu app, busca **"WhatsApp"** en la lista de productos
2. Haz clic en **"Configurar"** o **"Agregar producto"**
3. Selecciona **"WhatsApp"**
4. Haz clic en **"Configurar"**

### 2.3 Obtener el Token de Acceso (WHATSAPP_TOKEN)

1. En el menú lateral de WhatsApp, ve a **"Configuración"** → **"API Setup"**
2. Busca la sección **"Temporary access token"** o **"Access tokens"**
3. Verás un token que empieza con algo como `EAA...`
4. **⚠️ IMPORTANTE**: Este token es temporal (válido por 24 horas)
5. Para obtener un token permanente:
   - Ve a **"Sistema"** → **"Tokens de acceso"** en el menú lateral
   - O usa la herramienta de tokens en: https://developers.facebook.com/tools/explorer/
   - Selecciona tu app
   - Genera un token con permisos: `whatsapp_business_messaging`, `whatsapp_business_management`

**Copia este token** - será tu `WHATSAPP_TOKEN`

### 2.4 Obtener el Phone Number ID (PHONE_NUMBER_ID)

1. En WhatsApp → **"Configuración"** → **"API Setup"**
2. Busca la sección **"From"** o **"Phone number ID"**
3. Verás un número que parece: `123456789012345`
4. **Copia este número** - será tu `PHONE_NUMBER_ID`

**Nota**: Si no tienes un número de teléfono registrado:
- Necesitas un número de WhatsApp Business
- Puedes usar tu número personal temporalmente para pruebas
- O registrarte en Meta Business: https://business.facebook.com/

### 2.5 Crear el Verify Token (VERIFY_TOKEN)

Este es el más fácil:
- Puede ser cualquier cadena de texto segura
- Ejemplo: `mi_token_seguro_123` o `whatsapp_webhook_2025`
- **Anótalo** - lo usarás en el `.env` y cuando configures el webhook

**✅ Listo para WhatsApp!** Ahora tienes:
- `WHATSAPP_TOKEN`
- `PHONE_NUMBER_ID`
- `VERIFY_TOKEN` (lo creaste tú)

---

## 📝 PASO 3: Crear el Archivo .env

Ahora que tienes todas las credenciales, crea el archivo `.env`:

1. En la carpeta de tu proyecto, crea un archivo llamado `.env` (sin extensión)
2. Copia este contenido y reemplaza con tus valores:

```env
# Credenciales de WhatsApp
WHATSAPP_TOKEN=tu_token_aqui
PHONE_NUMBER_ID=tu_phone_number_id_aqui
VERIFY_TOKEN=mi_token_seguro_123

# Credenciales de Google Calendar
CALENDAR_ID=primary
GOOGLE_CREDENTIALS_PATH=./credentials.json

# Puerto del servidor
PORT=3000
```

### Ejemplo con valores reales:

```env
WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
PHONE_NUMBER_ID=123456789012345
VERIFY_TOKEN=mi_token_seguro_123
CALENDAR_ID=primary
GOOGLE_CREDENTIALS_PATH=./credentials.json
PORT=3000
```

---

## ✅ PASO 4: Verificar que Todo Esté Correcto

1. **Archivo `credentials.json`** debe estar en la raíz del proyecto
2. **Archivo `.env`** debe estar en la raíz del proyecto
3. **Estructura de carpetas**:
   ```
   Bot_Citas_Scheduler/
   ├── .env
   ├── credentials.json
   ├── whatsapp-calendar-bot.js
   ├── package.json
   └── public/
   ```

---

## 🚀 PASO 5: Probar el Bot

Ejecuta:
```bash
npm start
```

Deberías ver:
```
✅ Autenticación de Google inicializada
Bot de WhatsApp escuchando en puerto 3000
```

Abre tu navegador en: **http://localhost:3000**

---

## 🔧 Solución de Problemas

### Error: "Cannot find module"
- Ejecuta: `npm install`

### Error: "Google Auth failed"
- Verifica que `credentials.json` existe y está en la raíz
- Verifica que compartiste el calendario con la cuenta de servicio

### Error: "WHATSAPP_TOKEN invalid"
- El token puede haber expirado (si es temporal)
- Genera uno nuevo en Meta Developer Console

### El servidor no inicia
- Verifica que el puerto 3000 no esté en uso
- Revisa los logs en la consola

---

## 📞 ¿Necesitas Ayuda?

Si tienes problemas:
1. Revisa los logs del servidor
2. Verifica que todas las variables en `.env` estén correctas
3. Asegúrate de que `credentials.json` esté en la carpeta correcta

¡Listo! 🎉
