# 📥 Cómo Obtener el archivo credentials.json

## Paso 1: Ir a Google Cloud Console

1. Ve a: **https://console.cloud.google.com/**
2. Inicia sesión con tu cuenta de Google
3. Selecciona el proyecto que creaste (o crea uno nuevo)

## Paso 2: Habilitar Google Calendar API

1. En el menú lateral, ve a **"APIs y servicios"** → **"Biblioteca"**
2. Busca **"Google Calendar API"**
3. Haz clic en **"HABILITAR"** (si no está habilitada)

## Paso 3: Crear Cuenta de Servicio

1. Ve a **"APIs y servicios"** → **"Credenciales"**
2. Haz clic en **"CREAR CREDENCIALES"** (arriba)
3. Selecciona **"Cuenta de servicio"**
4. Completa:
   - **Nombre**: `whatsapp-bot-service` (o el que prefieras)
   - Haz clic en **"Crear y continuar"**
5. En "Otorgar acceso a este proyecto":
   - **Rol**: Selecciona **"Editor"** o **"Propietario"**
   - Haz clic en **"Continuar"**
6. Haz clic en **"Listo"**

## Paso 4: Descargar Credenciales JSON

1. En la lista de cuentas de servicio, busca la que acabas de crear
2. Haz clic en el **email de la cuenta** (termina en `@...iam.gserviceaccount.com`)
3. Ve a la pestaña **"CLAVES"**
4. Haz clic en **"Agregar clave"** → **"Crear nueva clave"**
5. Selecciona **"JSON"**
6. Haz clic en **"Crear"**
7. **Se descargará automáticamente un archivo JSON**

## Paso 5: Mover el archivo a tu proyecto

1. El archivo descargado tendrá un nombre como: `tu-proyecto-xxxxx-xxxxx.json`
2. **Renómbralo a**: `credentials.json`
3. **Muévelo a la carpeta del proyecto**: `/Users/benjaminmiranda/Desktop/Bot_Citas_Scheduler/`

### En Mac:
```bash
# Si está en Descargas:
mv ~/Downloads/tu-proyecto-*.json ~/Desktop/Bot_Citas_Scheduler/credentials.json
```

## Paso 6: Compartir Calendario con la Cuenta de Servicio

1. Abre **Google Calendar**: https://calendar.google.com
2. A la izquierda, haz clic en los **3 puntos** junto a "Mi calendario"
3. Selecciona **"Configuración y uso compartido"**
4. En "Compartir con personas específicas", haz clic en **"Agregar personas"**
5. Pega el **email de la cuenta de servicio** (el que termina en `@...iam.gserviceaccount.com`)
6. Selecciona el permiso: **"Hacer cambios en los eventos"**
7. Haz clic en **"Enviar"**

## ✅ Verificar

Ejecuta en tu terminal:
```bash
ls -la ~/Desktop/Bot_Citas_Scheduler/credentials.json
```

Deberías ver el archivo listado.

## 🔄 Reiniciar el Bot

Después de colocar el archivo:
```bash
npm start
```

Deberías ver:
```
✅ Autenticación de Google inicializada
```

---

## ⚠️ Alternativa: Usar Variable de Entorno

Si prefieres no usar archivo, puedes poner el contenido del JSON en una variable de entorno:

1. Abre el archivo `credentials.json` descargado
2. Copia TODO el contenido (es un JSON)
3. En tu archivo `.env`, agrega:
   ```env
   GOOGLE_CREDENTIALS={"type":"service_account","project_id":"...","private_key_id":"...",...}
   ```
4. **IMPORTANTE**: Debe estar en UNA sola línea, sin saltos de línea

Pero es más fácil usar el archivo `credentials.json` 😊
