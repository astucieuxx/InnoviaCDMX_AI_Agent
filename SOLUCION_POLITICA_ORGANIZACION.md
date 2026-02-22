# 🔒 Solución: Política de Organización Bloqueando Credenciales

Tu organización de Google Cloud tiene una política de seguridad que impide crear claves de cuenta de servicio. Aquí tienes **3 soluciones**:

---

## ✅ Solución 1: Crear Proyecto Personal (RECOMENDADO)

Crea un proyecto de Google Cloud **fuera de tu organización**:

### Pasos:

1. **Cerrar sesión de la cuenta organizacional** (si es posible)
   - O usar una cuenta personal de Google diferente

2. **Crear nuevo proyecto personal**:
   - Ve a: https://console.cloud.google.com/
   - Asegúrate de estar con una cuenta personal (no organizacional)
   - Crea un nuevo proyecto: "WhatsApp-Bot-Personal"

3. **Seguir los pasos normales**:
   - Habilitar Google Calendar API
   - Crear cuenta de servicio
   - Descargar credentials.json

**Ventaja**: No necesitas permisos de administrador

---

## ✅ Solución 2: Usar OAuth 2.0 (Más Complejo)

En lugar de cuenta de servicio, usar autenticación OAuth:

### Pasos:

1. **Crear credenciales OAuth 2.0**:
   - Ve a: APIs y servicios → Credenciales
   - "CREAR CREDENCIALES" → "ID de cliente de OAuth"
   - Tipo: "Aplicación de escritorio"
   - Descarga el JSON

2. **Modificar el código** para usar OAuth en lugar de cuenta de servicio

**Desventaja**: Requiere autenticación manual la primera vez

---

## ✅ Solución 3: Pedir al Administrador (Si es posible)

Si tienes acceso a un administrador:

1. Contacta al administrador de Google Cloud de tu organización
2. Pide que deshabilite temporalmente la política:
   - `iam.disableServiceAccountKeyCreation`
3. O que te otorgue permisos para crear claves

**Desventaja**: Puede tomar tiempo y puede que no te lo permitan

---

## 🎯 RECOMENDACIÓN: Solución 1 (Proyecto Personal)

Es la más rápida y no requiere permisos especiales:

1. Usa una cuenta personal de Google (Gmail personal)
2. Crea un proyecto nuevo en esa cuenta
3. Sigue los pasos normales de la guía

### ¿Por qué funciona?

- Los proyectos personales no tienen políticas organizacionales
- Puedes crear cuentas de servicio sin restricciones
- Es gratuito (mismo límite que proyectos organizacionales)

---

## 📝 Nota sobre Seguridad

Las políticas organizacionales existen por seguridad. Si usas un proyecto personal:
- ✅ Mantén el archivo `credentials.json` seguro
- ✅ No lo subas a Git (ya está en .gitignore)
- ✅ Úsalo solo para desarrollo personal/proyectos pequeños

---

## 🚀 Siguiente Paso

Una vez que tengas el `credentials.json` (de cualquier método):
1. Colócalo en: `/Users/benjaminmiranda/Desktop/Bot_Citas_Scheduler/`
2. Comparte tu calendario con el email de la cuenta de servicio
3. Reinicia el bot

¿Necesitas ayuda con algún paso específico?
