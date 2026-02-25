const express = require('express');
const axios = require('axios');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

// Import business configuration
const {
  getBusinessName,
  getBusinessAddress,
  getDefaultGreeting,
  getDefaultResponse,
  getAppointmentConfirmationMessage
} = require('./config');

// Import sessions and OpenAI client (legacy, will be replaced)
const sessions = require('./sessions');
const { getAIResponse, extractConversationData } = require('./openai-client');
const { extractAppointmentDate, parseDateFromText } = require('./date-parser');

// Import new intent-based architecture
const { classifyIntent } = require('./bot/classifier');
const { extractBrideProfile } = require('./bot/profile-extractor');
const { handlers } = require('./bot/handlers');
const { 
  isSlotAvailable,
  getAvailableSlots: getAvailableSlotsService,
  createCalendarEvent: createCalendarEventService,
  updateCalendarEvent: updateCalendarEventService,
  deleteCalendarEvent: deleteCalendarEventService,
  findEventsByName: findEventsByNameService
} = require('./bot/calendar-service');

const app = express();

// Sistema de logs en memoria
const logsBuffer = [];
const MAX_LOGS = 1000; // Mantener últimos 1000 logs

// Interceptar console.log, console.error, etc. para capturar logs
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

function addLog(level, ...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(arg => {
    if (typeof arg === 'object') {
      try {
        return JSON.stringify(arg, null, 2);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
  
  const logEntry = {
    timestamp,
    level,
    message
  };
  
  logsBuffer.push(logEntry);
  
  // Mantener solo los últimos MAX_LOGS
  if (logsBuffer.length > MAX_LOGS) {
    logsBuffer.shift();
  }
  
  // Llamar a la función original
  if (level === 'error') {
    originalConsoleError(...args);
  } else if (level === 'warn') {
    originalConsoleWarn(...args);
  } else {
    originalConsoleLog(...args);
  }
}

// Sobrescribir console methods
console.log = (...args) => addLog('log', ...args);
console.error = (...args) => addLog('error', ...args);
console.warn = (...args) => addLog('warn', ...args);

// Log inicial para verificar que el sistema funciona
console.log('✅ Sistema de logs inicializado correctamente');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// API Routes - Definir ANTES de express.static para evitar conflictos
// GET /api/logs - Obtener logs del sistema (definir temprano para que esté disponible)
app.get('/api/logs', (req, res) => {
  try {
    const { limit = 500, level, since } = req.query;
    
    // Usar originalConsoleLog para estos logs (no capturarlos en el buffer)
    // Esto evita que los logs sobre logs aparezcan en los logs
    // originalConsoleLog(`📋 Solicitud de logs - Buffer: ${logsBuffer.length} logs`);
    
    let filteredLogs = [...logsBuffer];
    
    // Filtrar por nivel si se especifica
    if (level && level !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.level === level);
      // originalConsoleLog(`📋 Filtrado por nivel "${level}": ${filteredLogs.length} logs`);
    }
    
    // Filtrar por fecha si se especifica
    if (since) {
      const sinceDate = new Date(since);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= sinceDate);
    }
    
    // Limitar cantidad
    const limitNum = parseInt(limit, 10);
    const logs = filteredLogs.slice(-limitNum);
    
    // originalConsoleLog(`📋 Enviando ${logs.length} logs al cliente`);
    
    res.json({
      logs,
      total: logsBuffer.length,
      filtered: filteredLogs.length,
      returned: logs.length
    });
  } catch (error) {
    originalConsoleError('Error en /api/logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint de prueba para verificar que el servidor responde
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Servidor funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Endpoint de diagnóstico para verificar horarios disponibles en una fecha específica
app.get('/api/check-slots/:date', async (req, res) => {
  try {
    const { date } = req.params; // Formato: YYYY-MM-DD
    
    console.log(`📅 [check-slots] Consultando horarios para: ${date}`);
    
    // Validar formato de fecha
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return res.status(400).json({ 
        error: 'Formato de fecha inválido. Use YYYY-MM-DD (ej: 2026-03-04)' 
      });
    }
    
    if (!authClient) {
      console.error('❌ [check-slots] Google Auth no inicializado');
      return res.status(500).json({ error: 'Google Auth no inicializado' });
    }

    let auth;
    if (authClient && typeof authClient.getClient === 'function') {
      auth = await authClient.getClient();
    } else {
      auth = authClient;
    }

    if (!innoviaCDMXCalendarId) {
      console.error('❌ [check-slots] Calendario "Innovia CDMX" no encontrado');
      return res.status(500).json({ error: 'Calendario "Innovia CDMX" no encontrado' });
    }

    console.log(`📅 [check-slots] Usando calendario: ${innoviaCDMXCalendarId}`);

    // Usar la misma lógica que getAvailableSlots
    const { getAvailableSlots: getAvailableSlotsService } = require('./bot/calendar-service');
    
    const slots = await getAvailableSlotsService(
      date,
      calendar,
      authClient,
      innoviaCDMXCalendarId,
      null
    );

    console.log(`📅 [check-slots] Slots encontrados: ${slots.length}`);

    // Formatear respuesta
    const formattedSlots = slots.map(slot => ({
      time: slot.time,
      start: slot.start,
      end: slot.end,
      eventId: slot.eventId,
      startTimestamp: slot.startTimestamp,
      availableSpots: slot.availableSpots,
      totalSpots: slot.totalSpots
    }));

    res.json({
      date: date,
      totalSlots: slots.length,
      slots: formattedSlots,
      slotsByTime: formattedSlots.map(s => s.time).join(', ')
    });
  } catch (error) {
    console.error('❌ [check-slots] Error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Endpoint temporal de diagnóstico para verificar citas en una fecha específica
app.get('/api/check-appointments/:date', async (req, res) => {
  try {
    const { date } = req.params; // Formato: YYYY-MM-DD
    const { hour, minute } = req.query; // Opcional: hora y minuto específicos
    
    if (!authClient) {
      return res.status(500).json({ error: 'Google Auth no inicializado' });
    }

    let auth;
    if (authClient && typeof authClient.getClient === 'function') {
      auth = await authClient.getClient();
    } else {
      auth = authClient;
    }

    const targetCalendarId = citasNuevasCalendarId || process.env.CALENDAR_ID || 'primary';
    
    // Crear rango del día
    const [year, month, day] = date.split('-').map(Number);
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59);

    const events = await calendar.events.list({
      auth: auth,
      calendarId: targetCalendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      timeZone: 'America/Mexico_City'
    });

    const eventItems = events.data.items || [];
    
    // Procesar eventos
    const appointments = eventItems.map(e => {
      let start, end;
      
      if (e.start.dateTime) {
        const startStr = e.start.dateTime;
        if (!startStr.endsWith('Z') && !startStr.match(/[+-]\d{2}:\d{2}$/)) {
          start = new Date(`${startStr}-06:00`);
          end = new Date(`${e.end.dateTime}-06:00`);
        } else {
          start = new Date(e.start.dateTime);
          end = new Date(e.end.dateTime);
        }
      } else if (e.start.date) {
        start = new Date(e.start.date + 'T00:00:00');
        end = new Date(e.end.date + 'T23:59:59');
      }

      return {
        id: e.id,
        summary: e.summary || 'Sin título',
        start: start.toISOString(),
        end: end.toISOString(),
        startCDMX: start.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
        endCDMX: end.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
        startTimeCDMX: start.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: true })
      };
    });

    // Si se especifica hora, filtrar por bloque
    let result = {
      date,
      total: appointments.length,
      appointments: appointments
    };

    if (hour !== undefined && minute !== undefined) {
      const blockHour = parseInt(hour);
      const blockMinute = parseInt(minute);
      const blockStart = new Date(`${date}T${String(blockHour).padStart(2, '0')}:${String(blockMinute).padStart(2, '0')}:00-06:00`);
      const blockEnd = new Date(blockStart.getTime() + 90 * 60 * 1000);

      const appointmentsInBlock = appointments.filter(apt => {
        const aptStart = new Date(apt.start).getTime();
        const aptEnd = new Date(apt.end).getTime();
        const blockStartTime = blockStart.getTime();
        const blockEndTime = blockEnd.getTime();
        return aptStart < blockEndTime && aptEnd > blockStartTime;
      });

      result.block = {
        hour: blockHour,
        minute: blockMinute,
        start: blockStart.toISOString(),
        end: blockEnd.toISOString(),
        count: appointmentsInBlock.length,
        appointments: appointmentsInBlock
      };
    }

    res.json(result);
  } catch (error) {
    console.error('Error en /api/check-appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve static files from public directory
app.use(express.static('public'));

// Credenciales de Chakra (BSP de WhatsApp)
// Limpiar API key (remover espacios, saltos de línea, etc.)
const CHAKRA_API_KEY = process.env.CHAKRA_API_KEY ? process.env.CHAKRA_API_KEY.trim().replace(/\s+/g, '') : null;
const CHAKRA_PLUGIN_ID = process.env.CHAKRA_PLUGIN_ID ? process.env.CHAKRA_PLUGIN_ID.trim() : null;
const CHAKRA_WHATSAPP_API_VERSION = process.env.CHAKRA_WHATSAPP_API_VERSION || 'v18.0';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'mi_token_seguro_123';

// Admin phone number for escalations
// Format: +[country code][number] (e.g., +19179605545 for US, +525521920710 for Mexico)
// Try to load from phone_config.json first, then fallback to env var or default
let ADMIN_PHONE = process.env.ADMIN_PHONE || '+19179605545';
try {
  const phoneConfigPath = path.join(__dirname, 'phone_config.json');
  if (fs.existsSync(phoneConfigPath)) {
    const phoneConfig = JSON.parse(fs.readFileSync(phoneConfigPath, 'utf8'));
    if (phoneConfig.adminPhone) {
      ADMIN_PHONE = phoneConfig.adminPhone;
      console.log(`✅ ADMIN_PHONE cargado desde phone_config.json: ${ADMIN_PHONE}`);
    }
  }
} catch (error) {
  console.warn('⚠️  No se pudo cargar phone_config.json, usando valor por defecto o variable de entorno');
}

// Configuración de Google Calendar
const calendar = google.calendar('v3');
let authClient;
let citasNuevasCalendarId = null; // ID del calendario "CITAS NUEVAS" (donde se guardan las citas agendadas)
let innoviaCDMXCalendarId = null; // ID del calendario "Innovia CDMX" (eventos azules sin nombre = spots disponibles)

// Inicializar autenticación de Google
async function initGoogleAuth() {
  try {
    let credentials = null;
    
    // PRIORIDAD 1: Variable de entorno GOOGLE_CREDENTIALS (para Railway/producción)
    if (process.env.GOOGLE_CREDENTIALS) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
        console.log('✅ Credenciales de Google cargadas desde variable de entorno GOOGLE_CREDENTIALS');
      } catch (error) {
        console.error('❌ Error parseando GOOGLE_CREDENTIALS:', error.message);
        throw new Error('GOOGLE_CREDENTIALS tiene formato JSON inválido');
      }
    }
    // PRIORIDAD 2: Archivo de credenciales local (para desarrollo)
    else {
      let credentialsFile = null;
      
      // Buscar archivo de credenciales
      if (fs.existsSync('./credentials.json')) {
        credentialsFile = './credentials.json';
      } else {
        // Buscar archivo client_secret_*.json
        const files = fs.readdirSync('.').filter(f => f.startsWith('client_secret_') && f.endsWith('.json'));
        if (files.length > 0) {
          credentialsFile = files[0];
        }
      }
      
      if (!credentialsFile) {
        throw new Error('No se encontró archivo de credenciales ni variable GOOGLE_CREDENTIALS');
      }
      
      credentials = JSON.parse(fs.readFileSync(credentialsFile, 'utf8'));
      console.log(`✅ Credenciales de Google cargadas desde archivo: ${credentialsFile}`);
    }
    
    // Verificar si es OAuth 2.0 o cuenta de servicio
    if (credentials.installed || credentials.web) {
      // Es OAuth 2.0 - usar OAuth2Client
      const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
      const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
      
      // Verificar si ya tenemos token guardado
      // PRIORIDAD 1: Variable de entorno GOOGLE_TOKEN (para Railway/producción)
      let token = null;
      if (process.env.GOOGLE_TOKEN) {
        try {
          token = JSON.parse(process.env.GOOGLE_TOKEN);
          console.log('✅ Token de Google cargado desde variable de entorno GOOGLE_TOKEN');
        } catch (error) {
          console.error('❌ Error parseando GOOGLE_TOKEN:', error.message);
        }
      }
      // PRIORIDAD 2: Archivo token.json local (para desarrollo)
      else {
        const TOKEN_PATH = path.join(__dirname, 'token.json');
        if (fs.existsSync(TOKEN_PATH)) {
          token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
          console.log('✅ Token de Google cargado desde archivo token.json');
        }
      }
      
      if (token) {
        oAuth2Client.setCredentials(token);
        authClient = oAuth2Client;
        console.log('✅ Autenticación de Google inicializada (token existente)');
      } else {
        // Necesitamos autenticación interactiva
        console.log('\n🔐 ============================================');
        console.log('   PRIMERA AUTENTICACIÓN CON GOOGLE CALENDAR');
        console.log('============================================\n');
        console.log('📋 Pasos:');
        console.log('   1. Abre esta URL en tu navegador:');
        console.log('   2. Inicia sesión y autoriza la aplicación');
        console.log('   3. Si ves "App no verificada", haz clic en "Avanzado" → "Ir a Calendar Bot"');
        console.log('   4. Después de autorizar, te redirigirá a localhost (ignora el error)');
        console.log('   5. Copia el código de la URL (la parte después de "code=")');
        console.log('   6. Pégalo aquí abajo\n');
        
        const authUrl = oAuth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: ['https://www.googleapis.com/auth/calendar'],
          prompt: 'consent' // Forzar mostrar pantalla de consentimiento
        });
        
        console.log('🔗 URL de autorización:');
        console.log(authUrl);
        console.log('\n💡 Ejemplo del código que necesitas copiar:');
        console.log('   Si la URL es: http://localhost/?code=4/0Aean...&scope=...');
        console.log('   Copia solo: 4/0Aean...\n');
        console.log('⚠️  Nota: El error de localhost es normal, solo copia el código de la URL\n');
        
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        
        rl.question('📝 Pega el código de autorización aquí: ', async (code) => {
          rl.close();
          try {
            // Limpiar el código (puede venir con parámetros adicionales de la URL)
            const cleanCode = code.trim().split('&')[0].split('?code=').pop();
            const { tokens } = await oAuth2Client.getToken(cleanCode);
            oAuth2Client.setCredentials(tokens);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
            authClient = oAuth2Client;
            console.log('\n✅ Autenticación de Google completada y guardada');
            console.log('✅ El bot ahora puede consultar Google Calendar');
            console.log('✅ No necesitarás autorizar de nuevo\n');
          } catch (error) {
            console.error('\n❌ Error al obtener token:', error.message);
            console.error('   Asegúrate de copiar el código completo de la URL');
            console.warn('⚠️  El bot funcionará pero NO consultará Google Calendar\n');
            authClient = null;
          }
        });
        // Continuar - la autenticación se completará cuando el usuario ingrese el código
        // El bot puede funcionar mientras tanto (usará horarios por defecto)
      }
    } else if (credentials.type === 'service_account') {
      // Es cuenta de servicio - usar GoogleAuth
      authClient = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/calendar']
      });
      console.log('✅ Autenticación de Google inicializada (cuenta de servicio)');
    } else {
      throw new Error('Formato de credenciales no reconocido');
    }
  } catch (error) {
    console.error('❌ Error inicializando Google Auth:', error.message);
    console.warn('⚠️  El bot funcionará pero NO consultará Google Calendar');
  }
  
  // Buscar los calendarios necesarios después de inicializar auth
  if (authClient) {
    await findCitasNuevasCalendar();
    await findInnoviaCDMXCalendar();
  }
}

// Función para buscar el calendario "CITAS NUEVAS" por nombre
async function findCitasNuevasCalendar() {
  try {
    if (!authClient) {
      console.warn('⚠️  Google Auth no inicializado, no se puede buscar calendario');
      return;
    }

    // Obtener cliente de autenticación
    let auth;
    if (authClient && typeof authClient.getClient === 'function') {
      auth = await authClient.getClient();
    } else {
      auth = authClient;
    }

    console.log('🔍 Buscando calendario "CITAS NUEVAS"...');
    
    // Listar todos los calendarios del usuario
    const calendarList = await calendar.calendarList.list({
      auth: auth,
      minAccessRole: 'writer' // Solo calendarios donde podemos escribir
    });

    console.log(`   Calendarios encontrados: ${calendarList.data.items.length}`);
    console.log('   Lista de calendarios:');
    calendarList.data.items.forEach(cal => {
      console.log(`     - ${cal.summary} (ID: ${cal.id})`);
    });

    // Buscar el calendario con nombre exacto "CITAS NUEVAS" (case-insensitive)
    const citasNuevas = calendarList.data.items.find(cal => {
      if (!cal.summary) return false;
      const nameUpper = cal.summary.toUpperCase().trim();
      return nameUpper === 'CITAS NUEVAS' || nameUpper.includes('CITAS NUEVAS');
    });

    if (citasNuevas) {
      citasNuevasCalendarId = citasNuevas.id;
      console.log(`✅ Calendario "CITAS NUEVAS" encontrado: ${citasNuevasCalendarId}`);
      console.log(`   Nombre: ${citasNuevas.summary}`);
      console.log(`   Color: ${citasNuevas.backgroundColor || 'N/A'}`);
      console.log(`   📌 Este será el calendario usado para todas las operaciones de citas`);
    } else {
      console.warn('⚠️  No se encontró calendario "CITAS NUEVAS"');
      console.warn('   Buscando por nombre alternativo...');
      
      // Intentar buscar por variaciones del nombre
      const alternativeNames = ['CITAS', 'NUEVAS', 'CITASNUEVAS'];
      const alternative = calendarList.data.items.find(cal => {
        if (!cal.summary) return false;
        const nameUpper = cal.summary.toUpperCase().trim();
        return alternativeNames.some(alt => nameUpper.includes(alt));
      });
      
      if (alternative) {
        console.warn(`   ⚠️  Se encontró un calendario similar: "${alternative.summary}"`);
        console.warn('   Por favor, asegúrate de que el calendario se llame exactamente "CITAS NUEVAS"');
      }
      
      console.warn('   Usando CALENDAR_ID de variables de entorno o "primary"');
      citasNuevasCalendarId = process.env.CALENDAR_ID || 'primary';
      console.warn(`   ⚠️  Calendar ID a usar: ${citasNuevasCalendarId}`);
    }
  } catch (error) {
    console.error('❌ Error buscando calendario "CITAS NUEVAS":', error.message);
    console.warn('   Usando CALENDAR_ID de variables de entorno o "primary"');
    citasNuevasCalendarId = process.env.CALENDAR_ID || 'primary';
  }
}

// Función para buscar el calendario "Innovia CDMX" por nombre
async function findInnoviaCDMXCalendar() {
  try {
    if (!authClient) {
      console.warn('⚠️  Google Auth no inicializado, no se puede buscar calendario');
      return;
    }

    let auth;
    if (authClient && typeof authClient.getClient === 'function') {
      auth = await authClient.getClient();
    } else {
      auth = authClient;
    }

    console.log('🔍 Buscando calendario "Innovia CDMX"...');
    
    // Listar todos los calendarios del usuario
    const calendarList = await calendar.calendarList.list({
      auth: auth,
      minAccessRole: 'writer' // Solo calendarios donde podemos escribir
    });

    console.log(`   Calendarios encontrados: ${calendarList.data.items.length}`);
    
    // Buscar el calendario con nombre "Innovia CDMX" (case-insensitive)
    const innoviaCDMX = calendarList.data.items.find(cal => {
      if (!cal.summary) return false;
      const nameUpper = cal.summary.toUpperCase().trim();
      return nameUpper === 'INNOVIA CDMX' || nameUpper.includes('INNOVIA CDMX');
    });

    if (innoviaCDMX) {
      innoviaCDMXCalendarId = innoviaCDMX.id;
      console.log(`✅ Calendario "Innovia CDMX" encontrado: ${innoviaCDMXCalendarId}`);
      console.log(`   Nombre: ${innoviaCDMX.summary}`);
      console.log(`   Color: ${innoviaCDMX.backgroundColor || 'N/A'}`);
      console.log(`   📌 Este calendario contiene los eventos azules (spots disponibles)`);
    } else {
      console.warn('⚠️  No se encontró calendario "Innovia CDMX"');
      console.warn('   Buscando por nombre alternativo...');
      
      // Intentar buscar por variaciones del nombre
      const alternativeNames = ['INNOVIA', 'CDMX'];
      const alternative = calendarList.data.items.find(cal => {
        if (!cal.summary) return false;
        const nameUpper = cal.summary.toUpperCase().trim();
        return alternativeNames.some(alt => nameUpper.includes(alt));
      });
      
      if (alternative) {
        innoviaCDMXCalendarId = alternative.id;
        console.warn(`   ⚠️  Calendario alternativo encontrado: "${alternative.summary}" (ID: ${innoviaCDMXCalendarId})`);
        console.warn('   Por favor, asegúrate de que el calendario se llame exactamente "Innovia CDMX"');
      } else {
        console.error('   ❌ No se encontró calendario "Innovia CDMX"');
        console.error('   El bot NO podrá determinar spots disponibles sin este calendario');
      }
    }
  } catch (error) {
    console.error('❌ Error buscando calendario "Innovia CDMX":', error.message);
    console.error('   El bot NO podrá determinar spots disponibles sin este calendario');
  }
}

// Función para verificar si un día está abierto según horarios del negocio
function isDayOpen(dateString) {
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const dayName = dayNames[dayOfWeek];
    
    const { getBusinessHours } = require('./config');
    const hours = getBusinessHours();
    
    // Verificar si el día está cerrado
    if (dayName === 'lunes' && hours.lunes === 'Cerrado') {
      console.log(`   ❌ ${dayName.charAt(0).toUpperCase() + dayName.slice(1)} está cerrado`);
      return false;
    }
    
    // Los demás días están abiertos según la configuración
    return true;
  } catch (error) {
    console.error('Error verificando día:', error);
    return true; // Por defecto permitir si hay error
  }
}

// Función para obtener horarios disponibles desde Google Calendar
// Usa bloques de 90 minutos con máximo 2 citas por bloque
async function getAvailableSlots(date) {
  try {
    // Verificar si el día está abierto
    if (!isDayOpen(date)) {
      console.log(`📅 ${date} está cerrado según horarios del negocio`);
      return []; // Retornar array vacío si está cerrado
    }
    
    if (!authClient) {
      console.warn('⚠️  Google Auth no inicializado, usando horarios por defecto');
      return getDefaultSlots(date);
    }

    // Obtener cliente de autenticación (compatible con OAuth2Client y GoogleAuth)
    let auth;
    if (authClient && typeof authClient.getClient === 'function') {
      // Es GoogleAuth (cuenta de servicio)
      auth = await authClient.getClient();
    } else {
      // Es OAuth2Client directamente
      auth = authClient;
    }
    
    // Crear fechas en zona horaria local (America/Mexico_City)
    // Formato de entrada: "2025-02-20"
    const [year, month, day] = date.split('-').map(Number);
    const startOfDay = new Date(year, month - 1, day, 11, 0, 0); // 11:00 AM hora local
    const endOfDay = new Date(year, month - 1, day, 20, 0, 0);   // 8:00 PM hora local

    console.log(`📅 Consultando Google Calendar para ${date}`);
    console.log(`   Rango: ${startOfDay.toLocaleString('es-MX')} - ${endOfDay.toLocaleString('es-MX')}`);

    // Usar el calendario "CITAS NUEVAS" si está disponible, sino usar el configurado
    const targetCalendarId = citasNuevasCalendarId || process.env.CALENDAR_ID || 'primary';
    console.log(`   Consultando calendario: ${targetCalendarId === citasNuevasCalendarId ? '"CITAS NUEVAS"' : targetCalendarId}`);

    const events = await calendar.events.list({
      auth: auth,
      calendarId: targetCalendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      timeZone: 'America/Mexico_City'
    });

    const eventItems = events.data.items || [];
    console.log(`   Eventos encontrados: ${eventItems.length}`);

    // Procesar eventos y convertir a fechas locales
    const bookedEvents = eventItems.map(e => {
      let start, end;
      
      // Manejar eventos con hora (dateTime) y eventos de todo el día (date)
      if (e.start.dateTime) {
        start = new Date(e.start.dateTime);
        end = new Date(e.end.dateTime);
      } else if (e.start.date) {
        // Evento de todo el día - considerar que ocupa todo el día
        start = new Date(e.start.date + 'T00:00:00');
        end = new Date(e.end.date + 'T23:59:59');
      }
      
      // Solo contar eventos que parecen ser citas (contienen "Cita" en el título)
      const isAppointment = e.summary && e.summary.toLowerCase().includes('cita');
      
      return { start, end, summary: e.summary || 'Sin título', isAppointment };
    }).filter(e => e.isAppointment); // Solo eventos de citas

    console.log(`   Citas encontradas: ${bookedEvents.length}`);

    // Bloques de 90 minutos disponibles
    // Horarios: 11:00am, 12:30pm, 2:00pm, 3:30pm, 5:00pm, 6:30pm
    // Los domingos solo hasta las 5:00pm (no se ofrece 6:30pm)
    const allBlockTimes = [
      { hour: 11, minute: 0 },   // 11:00am - 12:30pm
      { hour: 12, minute: 30 },  // 12:30pm - 2:00pm
      { hour: 14, minute: 0 },   // 2:00pm - 3:30pm
      { hour: 15, minute: 30 },  // 3:30pm - 5:00pm
      { hour: 17, minute: 0 },   // 5:00pm - 6:30pm
      { hour: 18, minute: 30 }   // 6:30pm - 8:00pm
    ];

    // Determinar si es domingo (0 = domingo en JavaScript)
    // Usar zona horaria local de México para evitar problemas de UTC
    const dateObj = new Date(year, month - 1, day);
    const dayOfWeek = dateObj.getDay();
    const isSunday = dayOfWeek === 0;

    console.log(`   📅 Verificando día de la semana para ${date}: día ${dayOfWeek} (0=domingo, 1=lunes...)`);

    // Si es domingo, excluir el último bloque (6:30pm)
    const blockTimes = isSunday 
      ? allBlockTimes.slice(0, -1)  // Todos excepto el último
      : allBlockTimes;

    if (isSunday) {
      console.log(`   📅 ✅ Es domingo - solo horarios hasta las 5:00pm (excluyendo 6:30pm)`);
      console.log(`   📅 Bloques disponibles: ${blockTimes.length} (debería ser 5, no 6)`);
    } else {
      console.log(`   📅 No es domingo - todos los horarios disponibles (incluyendo 6:30pm)`);
    }

    const slots = [];
    const MAX_CITAS_POR_BLOQUE = 2;

    for (const blockTime of blockTimes) {
      const blockStart = new Date(year, month - 1, day, blockTime.hour, blockTime.minute, 0);
      const blockEnd = new Date(blockStart.getTime() + 90 * 60 * 1000); // 90 minutos después

      // Contar cuántas citas hay en este bloque
      let citasEnBloque = 0;
      bookedEvents.forEach(booked => {
        // Una cita está en el bloque si se solapa con él
        // Solapamiento: blockStart < booked.end && blockEnd > booked.start
        const overlaps = blockStart < booked.end && blockEnd > booked.start;
        if (overlaps) {
          citasEnBloque++;
          console.log(`   📌 Cita en bloque ${blockTime.hour}:${String(blockTime.minute).padStart(2, '0')}: ${booked.summary}`);
        }
      });

      // El bloque está disponible si tiene menos de 2 citas
      if (citasEnBloque < MAX_CITAS_POR_BLOQUE) {
        const availableSpots = MAX_CITAS_POR_BLOQUE - citasEnBloque;
        slots.push({
          time: blockStart.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: true }),
          start: blockStart.toISOString(),
          end: blockEnd.toISOString(),
          availableSpots: availableSpots,
          totalSpots: MAX_CITAS_POR_BLOQUE
        });
        console.log(`   ✅ Bloque ${blockTime.hour}:${String(blockTime.minute).padStart(2, '0')} disponible (${availableSpots}/${MAX_CITAS_POR_BLOQUE} espacios libres)`);
      } else {
        console.log(`   ❌ Bloque ${blockTime.hour}:${String(blockTime.minute).padStart(2, '0')} lleno (${citasEnBloque}/${MAX_CITAS_POR_BLOQUE} citas)`);
      }
    }

    console.log(`   📊 Total bloques disponibles: ${slots.length}`);
    
    if (slots.length === 0) {
      console.warn('   ⚠️  No hay bloques disponibles, usando horarios por defecto');
      return getDefaultSlots(date);
    }
    
    return slots;
  } catch (error) {
    console.error('❌ Error al consultar Google Calendar:', error.message);
    console.error('   Stack:', error.stack);
    console.warn('⚠️  Usando horarios por defecto');
    return getDefaultSlots(date);
  }
}

// Horarios por defecto si no se puede consultar Google Calendar
// Usa bloques de 90 minutos
// Los domingos solo hasta las 5:00pm (no se ofrece 6:30pm)
function getDefaultSlots(date) {
  const [year, month, day] = date.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const dayOfWeek = dateObj.getDay();
  const isSunday = dayOfWeek === 0;

  console.log(`   📅 [getDefaultSlots] Verificando día de la semana para ${date}: día ${dayOfWeek} (0=domingo, 1=lunes...)`);
  console.log(`   📅 [getDefaultSlots] Es domingo? ${isSunday}`);

  const allSlots = [
    { time: '11:00 AM', start: `${date}T11:00:00`, end: `${date}T12:30:00`, availableSpots: 2, totalSpots: 2 },
    { time: '12:30 PM', start: `${date}T12:30:00`, end: `${date}T14:00:00`, availableSpots: 2, totalSpots: 2 },
    { time: '2:00 PM', start: `${date}T14:00:00`, end: `${date}T15:30:00`, availableSpots: 2, totalSpots: 2 },
    { time: '3:30 PM', start: `${date}T15:30:00`, end: `${date}T17:00:00`, availableSpots: 2, totalSpots: 2 },
    { time: '5:00 PM', start: `${date}T17:00:00`, end: `${date}T18:30:00`, availableSpots: 2, totalSpots: 2 },
    { time: '6:30 PM', start: `${date}T18:30:00`, end: `${date}T20:00:00`, availableSpots: 2, totalSpots: 2 }
  ];

  // Si es domingo, excluir el último slot (6:30pm)
  const slots = isSunday ? allSlots.slice(0, -1) : allSlots;
  
  if (isSunday) {
    console.log(`   📅 ✅ [getDefaultSlots] Es domingo - excluyendo 6:30pm. Slots disponibles: ${slots.length} (debería ser 5)`);
    console.log(`   📅 [getDefaultSlots] Último slot: ${slots[slots.length - 1]?.time || 'N/A'}`);
  } else {
    console.log(`   📅 [getDefaultSlots] No es domingo - todos los slots incluidos. Total: ${slots.length}`);
  }
  
  return slots;
}

// Función para crear evento en Google Calendar
async function createCalendarEvent(name, phone, email, dateStart, fechaBoda = null) {
  try {
    if (!authClient) {
      console.warn('⚠️  Google Auth no inicializado, no se creará evento en Calendar');
      return null;
    }

    // Obtener cliente de autenticación (compatible con OAuth2Client y GoogleAuth)
    let auth;
    if (authClient && typeof authClient.getClient === 'function') {
      // Es GoogleAuth (cuenta de servicio)
      auth = await authClient.getClient();
    } else {
      // Es OAuth2Client directamente
      auth = authClient;
    }
    
    // Calcular fecha de fin: siempre 90 minutos después del inicio
    const startDate = new Date(dateStart);
    const endDate = new Date(startDate.getTime() + 90 * 60 * 1000); // 90 minutos
    
    // Formatear teléfono: XX XXX XXXX (formato mexicano de 10 dígitos)
    const formatPhone = (phoneNum) => {
      const cleaned = phoneNum.replace(/\D/g, '');
      if (cleaned.length >= 10) {
        // Tomar los últimos 10 dígitos (número mexicano sin código de país)
        const last10 = cleaned.slice(-10);
        // Formato: XX XXX XXXX (ej: 55 219 2071)
        return `${last10.slice(0, 2)} ${last10.slice(2, 5)} ${last10.slice(5)}`;
      }
      // Si tiene menos de 10 dígitos, devolver tal cual
      return cleaned;
    };
    
    // Formatear fecha de boda: DD/MM/AAAA
    const formatFechaBoda = (fecha) => {
      if (!fecha) return 'No especificada';
      try {
        // Si viene en formato YYYY-MM-DD
        if (fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = fecha.split('-');
          return `${day}/${month}/${year}`;
        }
        // Si ya está en otro formato, intentar parsear
        const dateObj = new Date(fecha);
        if (!isNaN(dateObj.getTime())) {
          const day = String(dateObj.getDate()).padStart(2, '0');
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const year = dateObj.getFullYear();
          return `${day}/${month}/${year}`;
        }
        return fecha;
      } catch (e) {
        return fecha;
      }
    };
    
    // Título: solo el nombre completo de la cliente
    const eventSummary = name || 'Cliente';
    
    // Descripción con formato solicitado
    let description = '';
    if (fechaBoda) {
      description += `FECHA DE BODA: ${formatFechaBoda(fechaBoda)}\n`;
    }
    description += `TELEFONO: ${formatPhone(phone)}\n`;
    if (email) {
      description += `EMAIL: ${email}\n`;
    }
    description += '\n*Cita creada por Calendar bot*';
    
    const event = {
      summary: eventSummary,
      description: description,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: 'America/Mexico_City'
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'America/Mexico_City'
      },
      attendees: email ? [{ email: email }] : []
    };

    // Usar el calendario "CITAS NUEVAS" si está disponible, sino usar el configurado
    const targetCalendarId = citasNuevasCalendarId || process.env.CALENDAR_ID || 'primary';
    
    console.log(`   Creando evento en calendario: ${targetCalendarId}`);
    
    const createdEvent = await calendar.events.insert({
      auth: auth,
      calendarId: targetCalendarId,
      resource: event
    });

    console.log('✅ Evento creado en Google Calendar:', createdEvent.data.id);
    console.log(`   Título: ${eventSummary}`);
    console.log(`   Duración: 90 minutos`);
    return createdEvent.data;
  } catch (error) {
    console.error('❌ Error al crear evento en Calendar:', error.message);
    return null;
  }
}

// Sessions are now managed by sessions.js module
// Removed: const conversations = {};

// Almacenar phone_number_id del webhook para usarlo en el endpoint
let whatsappPhoneNumberId = null;

// Función para enviar mensajes por WhatsApp usando API de Chakra
// Función para enviar indicador de "escribiendo..."
async function sendTypingIndicator(phoneNumber, action = 'typing_on') {
  // Limpiar número de teléfono
  const cleanPhone = phoneNumber.replace(/\D/g, '');
  
  // CAPA DE SEGURIDAD: Verificar estado del bot ANTES de enviar cualquier indicador
  const botMode = getBotMode();
  console.log(`🔍 [TYPING CHECK] Modo del bot: ${botMode}, número: ${phoneNumber} (${cleanPhone})`);
  
  if (botMode === 'inactive') {
    console.log(`⏸️  [TYPING CHECK] Bot INACTIVO - Typing indicator BLOQUEADO`);
    return; // No enviar typing indicator si el bot está inactivo
  } else if (botMode === 'test') {
    const TEST_PHONE_FULL = '525521920710';
    const TEST_PHONE_SHORT = '5521920710';
    const exactMatchFull = cleanPhone === TEST_PHONE_FULL;
    const exactMatchShort = cleanPhone === TEST_PHONE_SHORT;
    const endsWithMatch = cleanPhone.length >= 10 && cleanPhone.length <= 12 && cleanPhone.endsWith(TEST_PHONE_SHORT);
    const phoneMatches = exactMatchFull || exactMatchShort || endsWithMatch;
    
    if (!phoneMatches) {
      console.log(`🧪 [TYPING CHECK] MODO DE PRUEBAS - Typing indicator BLOQUEADO para ${phoneNumber} (${cleanPhone})`);
      return; // No enviar typing indicator si no es el número de pruebas
    } else {
      console.log(`🧪 [TYPING CHECK] MODO DE PRUEBAS - Número permitido, enviando typing indicator`);
    }
  } else {
    console.log(`✅ [TYPING CHECK] Bot ACTIVO - Enviando typing indicator`);
  }
  
  try {
    // Verificar que tenemos los datos necesarios
    if (!CHAKRA_PLUGIN_ID || !whatsappPhoneNumberId) {
      // Si no tenemos los datos, simplemente retornar sin error (no crítico)
      return;
    }
    
    // Endpoint para typing indicator
    const endpoint = `https://api.chakrahq.com/v1/ext/plugin/whatsapp/${CHAKRA_PLUGIN_ID}/api/${CHAKRA_WHATSAPP_API_VERSION}/${whatsappPhoneNumberId}/messages`;
    
    // Payload para typing indicator según WhatsApp Business API
    const payload = {
      messaging_product: 'whatsapp',
      to: cleanPhone,
      type: 'typing',
      typing: {
        action: action // 'typing_on' o 'typing_off'
      }
    };
    
    // Intentar enviar el typing indicator (no crítico si falla)
    try {
      // Limpiar API key antes de usarlo
      const cleanApiKey = CHAKRA_API_KEY ? CHAKRA_API_KEY.trim().replace(/\s+/g, '') : '';
      
      await axios.post(
        endpoint,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${cleanApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      if (action === 'typing_on') {
        console.log(`✍️  Indicador de "escribiendo..." activado para ${cleanPhone}`);
      }
    } catch (typingError) {
      // No es crítico si el typing indicator falla, solo loguear
      console.log(`⚠️  No se pudo enviar typing indicator (no crítico): ${typingError.message}`);
    }
  } catch (error) {
    // No lanzar error, solo loguear
    console.log(`⚠️  Error en sendTypingIndicator (no crítico): ${error.message}`);
  }
}

async function sendWhatsAppMessage(phoneNumber, message, options = {}) {
  // Limpiar número de teléfono (remover espacios, guiones, etc.)
  // Definir fuera del try para que esté disponible en el catch
  const cleanPhone = phoneNumber ? phoneNumber.replace(/\D/g, '') : 'unknown';
  
  // CAPA DE SEGURIDAD CRÍTICA: Verificar estado del bot ANTES de enviar cualquier mensaje
  const botMode = getBotMode();
  console.log(`\n🔍 ============================================`);
  console.log(`🔍 [SEND MSG CHECK] VERIFICACIÓN ANTES DE ENVIAR`);
  console.log(`🔍 ============================================`);
  console.log(`🔍 Modo del bot: "${botMode}"`);
  console.log(`🔍 Tipo: ${typeof botMode}`);
  console.log(`🔍 Enviando a: ${phoneNumber} (limpio: ${cleanPhone})`);
  
  // Validación estricta del modo
  const validModes = ['inactive', 'test', 'active'];
  if (!validModes.includes(botMode)) {
    console.error(`❌ [SEND MSG CHECK] Modo inválido: "${botMode}"`);
    console.error(`❌ [SEND MSG CHECK] Por seguridad, bloqueando mensaje`);
    console.log(`🔍 ============================================\n`);
    return { success: false, blocked: true, reason: 'invalid_mode' };
  }
  
  if (botMode === 'inactive') {
    console.log(`⏸️  ============================================`);
    console.log(`⏸️  [SEND MSG CHECK] Bot INACTIVO - MENSAJE BLOQUEADO`);
    console.log(`⏸️  ============================================`);
    console.log(`⏸️  NO se enviará el mensaje`);
    console.log(`⏸️  Return inmediato con blocked=true`);
    console.log(`⏸️  ============================================\n`);
    return { success: false, blocked: true, reason: 'bot_inactive' };
  } else if (botMode === 'test') {
    const TEST_PHONE_FULL = '525521920710';
    const TEST_PHONE_SHORT = '5521920710';
    const exactMatchFull = cleanPhone === TEST_PHONE_FULL;
    const exactMatchShort = cleanPhone === TEST_PHONE_SHORT;
    const endsWithMatch = cleanPhone.length >= 10 && cleanPhone.length <= 12 && cleanPhone.endsWith(TEST_PHONE_SHORT);
    const phoneMatches = exactMatchFull || exactMatchShort || endsWithMatch;
    
    if (!phoneMatches) {
      console.log(`🧪 ============================================`);
      console.log(`🧪 [SEND MSG CHECK] MODO DE PRUEBAS - MENSAJE BLOQUEADO`);
      console.log(`🧪 ============================================`);
      console.log(`🧪 Número: ${phoneNumber} (limpio: ${cleanPhone})`);
      console.log(`🧪 NO se enviará el mensaje`);
      console.log(`🧪 Return inmediato con blocked=true`);
      console.log(`🧪 ============================================\n`);
      return { success: false, blocked: true, reason: 'test_mode_active' };
    } else {
      console.log(`🧪 [SEND MSG CHECK] MODO DE PRUEBAS - Número permitido, enviando mensaje`);
    }
  } else {
    console.log(`✅ [SEND MSG CHECK] Bot ACTIVO - Enviando mensaje`);
  }
  console.log(`🔍 ============================================\n`);
  
  try {
    // Verificar que tenemos los datos necesarios
    if (!CHAKRA_API_KEY || CHAKRA_API_KEY.trim().length === 0) {
      throw new Error('CHAKRA_API_KEY no está configurado. Configúralo en Railway → Variables.');
    }
    
    if (!CHAKRA_PLUGIN_ID || CHAKRA_PLUGIN_ID.trim().length === 0) {
      throw new Error('CHAKRA_PLUGIN_ID no está configurado. Obtén el Plugin ID del panel de Chakra.');
    }
    
    if (!whatsappPhoneNumberId) {
      throw new Error('whatsappPhoneNumberId no está disponible. Espera recibir un mensaje primero para obtenerlo del webhook.');
    }
    
    // Endpoint correcto según documentación de Chakra
    const endpoint = `https://api.chakrahq.com/v1/ext/plugin/whatsapp/${CHAKRA_PLUGIN_ID}/api/${CHAKRA_WHATSAPP_API_VERSION}/${whatsappPhoneNumberId}/messages`;
    
    let payload;
    
    // Si hay botones, enviar mensaje interactivo
    if (options.buttons && options.buttons.length > 0) {
      // WhatsApp permite máximo 3 botones
      const buttons = options.buttons.slice(0, 3).map((btn, index) => ({
        type: 'reply',
        reply: {
          id: btn.id || `btn_${index}`,
          title: btn.title || btn.text
        }
      }));
      
      payload = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: message
          },
          action: {
            buttons: buttons
          }
        }
      };
    } else {
      // Mensaje de texto normal
      payload = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: {
          body: message
        }
      };
    }
    
    // Log solo si hay error o para debugging importante
    
    // Validar y limpiar API key antes de usarlo
    if (!CHAKRA_API_KEY || CHAKRA_API_KEY.trim().length === 0) {
      throw new Error('CHAKRA_API_KEY no está configurado o está vacío');
    }
    
    const cleanApiKey = CHAKRA_API_KEY.trim().replace(/\s+/g, '');
    
    const response = await axios.post(
      endpoint,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${cleanApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Detener typing indicator después de enviar el mensaje
    // (el mensaje real debería detenerlo automáticamente, pero por si acaso)
    await sendTypingIndicator(cleanPhone, 'typing_off');
    
    return response.data;
    
  } catch (error) {
    console.error(`❌ Error enviando mensaje a ${cleanPhone}`);
    
    // Mostrar información detallada del error
    if (error.response) {
      // Error de respuesta HTTP
      const status = error.response.status;
      console.error(`   HTTP ${status}: ${error.response.statusText}`);
      
      if (status === 401) {
        console.error(`   ⚠️  ERROR DE AUTENTICACIÓN`);
        console.error(`   El API key de Chakra no es válido o no tiene permisos`);
        console.error(`   Verifica en Railway → Variables que CHAKRA_API_KEY sea correcto`);
        console.error(`   Verifica en Chakra que el API key tenga permisos de "Chakra Bot"`);
      }
      
      if (error.response.data) {
        try {
          const errorData = typeof error.response.data === 'string' 
            ? error.response.data 
            : JSON.stringify(error.response.data, null, 2);
          console.error(`   Respuesta: ${errorData.substring(0, 500)}`);
        } catch (e) {
          console.error(`   Respuesta: ${String(error.response.data).substring(0, 200)}`);
        }
      }
    } else if (error.request) {
      // Error de red (no hubo respuesta)
      console.error(`   Error de red: No se recibió respuesta del servidor`);
      console.error(`   Request: ${error.request.method || 'POST'} ${endpoint}`);
    } else {
      // Otro tipo de error
      console.error(`   Error: ${error.message || String(error)}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`);
      }
    }
    
    throw error;
  }
}

// Endpoint raíz para verificar que el servidor está funcionando
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Bot de WhatsApp funcionando',
    endpoints: {
      test: '/api/test',
      checkSlots: '/api/check-slots/:date',
      checkAppointments: '/api/check-appointments/:date',
      logs: '/api/logs',
      stats: '/api/stats',
      analytics: '/api/analytics'
    },
    timestamp: new Date().toISOString()
  });
});

// Serve index.html at /dashboard (para no interferir con el endpoint raíz)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Verificación del webhook (GET) - Chakra puede requerir esto
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Algunos BSPs usan verificación similar a Meta
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado');
    res.status(200).send(challenge);
  } else {
    // Si no hay parámetros de verificación, responder 200
    res.sendStatus(200);
  }
});

// Webhook para recibir mensajes de WhatsApp (POST) - Formato Chakra/WhatsApp Cloud API
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    
    console.log('\n🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨');
    console.log('🚨 WEBHOOK RECIBIDO - INICIO');
    console.log('🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨');
    console.log('📥 ============================================');
    console.log('📥 WEBHOOK RECIBIDO DE CHAKRA');
    console.log('📥 ============================================');
    console.log('📥 Timestamp:', new Date().toISOString());
    console.log('📥 Body completo:', JSON.stringify(body, null, 2));
    console.log('📥 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('📥 ============================================');

    // Formato estándar WhatsApp Cloud API (usado por Chakra)
    // Puede venir en formato: { object: 'whatsapp_business_account', entry: [...] }
    // O formato simplificado: { messages: [...] }
    
    let messages = [];

    // Formato estándar WhatsApp Cloud API (Meta/Chakra)
    if (body.object === 'whatsapp_business_account' && body.entry) {
      for (const entry of body.entry) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.value) {
            // Extraer phone_number_id del webhook para usarlo en el endpoint
            if (change.value.metadata && change.value.metadata.phone_number_id) {
              whatsappPhoneNumberId = change.value.metadata.phone_number_id;
              console.log(`📱 Phone Number ID extraído: ${whatsappPhoneNumberId}`);
            }
            
            if (change.value.messages) {
              messages = messages.concat(change.value.messages);
            }
            
            // Manejar statuses (estados de mensajes enviados)
            if (change.value.statuses && Array.isArray(change.value.statuses)) {
              for (const status of change.value.statuses) {
                const recipientId = status.recipient_id;
                const messageStatus = status.status;
                const messageId = status.id;
                
                console.log(`📊 Estado de mensaje: ${messageStatus} para ${recipientId} (ID: ${messageId})`);
                
                // Si el mensaje falló, verificar si es el admin y notificar
                if (messageStatus === 'failed' && status.errors && status.errors.length > 0) {
                  const error = status.errors[0];
                  console.error(`❌ Mensaje falló para ${recipientId}:`, error);
                  
                  // Verificar si es el admin (comparar números limpios)
                  const adminPhoneClean = ADMIN_PHONE.replace(/\D/g, '');
                  const recipientClean = recipientId.replace(/\D/g, '');
                  
                  if (recipientClean === adminPhoneClean) {
                    console.error(`\n⚠️  ============================================`);
                    console.error(`⚠️  MENSAJE AL ADMIN FALLÓ`);
                    console.error(`   Admin: ${ADMIN_PHONE} (${adminPhoneClean})`);
                    console.error(`   Error Code: ${error.code}`);
                    console.error(`   Error: ${error.message}`);
                    if (error.error_data?.details) {
                      console.error(`   Detalles: ${error.error_data.details}`);
                    }
                    console.error(`   ⚠️  El admin necesita enviar un mensaje al bot para reanudar la conversación.`);
                    console.error(`============================================\n`);
                    
                    // Opcional: Guardar en una variable para mostrar al usuario
                    // Por ahora solo logueamos
                  }
                }
              }
            }
          }
        }
      }
    }
    // Formato alternativo (si Chakra envía directamente)
    else if (body.messages && Array.isArray(body.messages)) {
      console.log('📥 Formato alternativo detectado: body.messages');
      messages = body.messages;
    }
    // Formato directo (un solo mensaje)
    else if (body.from && body.text) {
      console.log('📥 Formato directo detectado: body.from y body.text');
      messages = [body];
    }
    else {
      console.log('⚠️  Formato de webhook no reconocido. Body keys:', Object.keys(body));
      console.log('⚠️  Body completo:', JSON.stringify(body, null, 2));
    }

    console.log(`📥 Total de mensajes encontrados en webhook: ${messages.length}`);
    
    if (messages.length === 0) {
      console.log('⚠️  No se encontraron mensajes en el webhook. Body recibido:', JSON.stringify(body, null, 2));
    }
    
    // Procesar cada mensaje
    for (const message of messages) {
      const senderPhone = message.from || message.wa_id;
      
      console.log(`📨 Procesando mensaje - Tipo: ${message.type}, De: ${senderPhone}, Contenido:`, JSON.stringify(message, null, 2));
      
      // Manejar mensajes de texto
      if (message.type === 'text' || message.text) {
        const incomingMessage = message.text?.body || message.text || message.body;
        
        if (senderPhone && incomingMessage) {
          console.log(`\n📨 ============================================`);
          console.log(`📨 MENSAJE DE TEXTO RECIBIDO EN WEBHOOK`);
          console.log(`📨 ============================================`);
          console.log(`📨 De: ${senderPhone}`);
          console.log(`📨 Mensaje: ${incomingMessage}`);
          console.log(`📨 Timestamp: ${new Date().toISOString()}`);
          console.log(`📨 ============================================\n`);
          
          // CRITICAL: Verificar estado del bot ANTES de procesar
          console.log(`🔍 [WEBHOOK CHECK] Iniciando verificación del modo del bot...`);
          const botMode = getBotMode();
          const cleanPhone = senderPhone.replace(/\D/g, '');
          const isInactive = String(botMode).trim().toLowerCase() === 'inactive';
          
          console.log(`🔍 [WEBHOOK CHECK] ============================================`);
          console.log(`🔍 [WEBHOOK CHECK] Verificación antes de processIncomingMessage`);
          console.log(`🔍 [WEBHOOK CHECK] Modo del bot leído: "${botMode}"`);
          console.log(`🔍 [WEBHOOK CHECK] Tipo: ${typeof botMode}`);
          console.log(`🔍 [WEBHOOK CHECK] Comparación: String("${botMode}").trim().toLowerCase() === 'inactive'`);
          console.log(`🔍 [WEBHOOK CHECK] Resultado: ${isInactive}`);
          console.log(`🔍 [WEBHOOK CHECK] ============================================\n`);
          
          if (isInactive) {
            console.log(`⏸️  ============================================`);
            console.log(`⏸️  [WEBHOOK CHECK] BOT INACTIVO - BLOQUEO EN WEBHOOK`);
            console.log(`⏸️  ============================================`);
            console.log(`⏸️  NO se llamará a processIncomingMessage`);
            console.log(`⏸️  NO se procesará el mensaje`);
            console.log(`⏸️  Mensaje bloqueado completamente`);
            console.log(`⏸️  ============================================\n`);
            continue; // Saltar este mensaje y continuar con el siguiente (si hay)
          }
          
          console.log(`✅ [WEBHOOK CHECK] Bot no está inactive, continuando con processIncomingMessage...\n`);
          
          // Procesar el mensaje (no esperar para responder rápido al webhook)
          processIncomingMessage(senderPhone, incomingMessage, {}).catch(error => {
            // Si el error es porque el bot está inactivo, no es un error real
            if (error.message === 'BOT_INACTIVE_BLOCKED' || error.message === 'BOT_TEST_MODE_BLOCKED' || error.message === 'BOT_INVALID_MODE_BLOCKED') {
              console.log(`⏸️  Mensaje bloqueado correctamente - ${error.message}`);
              return; // No loguear como error
            }
            console.error('❌ Error procesando mensaje:', error);
            console.error('   Stack:', error.stack);
          });
        } else {
          console.log(`⚠️  Mensaje de texto sin senderPhone o incomingMessage. senderPhone: ${senderPhone}, incomingMessage: ${incomingMessage}`);
        }
      }
      // Manejar respuestas de botones interactivos
      else if (message.type === 'interactive' && message.interactive) {
        const interactive = message.interactive;
        
        if (interactive.type === 'button_reply') {
          const buttonId = interactive.button_reply?.id;
          const buttonTitle = interactive.button_reply?.title;
          
          console.log(`🔘 Botón presionado por ${senderPhone}: ${buttonId} - "${buttonTitle}"`);
          
          // CRITICAL: Verificar estado del bot ANTES de procesar botón
          const botMode = getBotMode();
          const isInactive = String(botMode).trim().toLowerCase() === 'inactive';
          
          console.log(`🔍 [WEBHOOK CHECK] Verificación antes de processIncomingMessage (botón)`);
          console.log(`🔍 [WEBHOOK CHECK] Modo del bot: "${botMode}"`);
          console.log(`🔍 [WEBHOOK CHECK] ¿Es inactive?: ${isInactive}`);
          
          if (isInactive) {
            console.log(`⏸️  [WEBHOOK CHECK] Bot INACTIVO - NO se procesará el botón`);
            return; // No procesar el botón
          }
          
          // Procesar la respuesta del botón como si fuera un mensaje de texto
          // El botón puede tener un ID como "slot_0", "slot_1", etc.
          if (senderPhone && buttonId) {
            processIncomingMessage(senderPhone, buttonId, { isButtonClick: true, buttonTitle }).catch(error => {
              // Si el error es porque el bot está inactivo, no es un error real
              if (error.message === 'BOT_INACTIVE_BLOCKED' || error.message === 'BOT_TEST_MODE_BLOCKED' || error.message === 'BOT_INVALID_MODE_BLOCKED') {
                console.log(`⏸️  Botón bloqueado correctamente - ${error.message}`);
                return; // No loguear como error
              }
              console.error('Error procesando respuesta de botón:', error);
            });
          }
        }
      }
    }

    // Responder 200 inmediatamente para confirmar recepción
    res.sendStatus(200);
  } catch (error) {
    console.error('❌ Error en webhook:', error);
    res.sendStatus(500);
  }
});

// Sistema unificado de estado del bot
// Modos: 'inactive' (inactivo), 'test' (solo +525521920710), 'active' (todos)
function getBotMode() {
  try {
    // CRITICAL: Usar path absoluto para Railway
    const statusPath = path.join(__dirname, 'bot_status.json');
    console.log(`🔍 [GET BOT MODE] Leyendo archivo: ${statusPath}`);
    console.log(`🔍 [GET BOT MODE] __dirname: ${__dirname}`);
    console.log(`🔍 [GET BOT MODE] ¿Existe?: ${fs.existsSync(statusPath)}`);
    
    if (fs.existsSync(statusPath)) {
      const statusData = fs.readFileSync(statusPath, 'utf8');
      console.log(`🔍 [GET BOT MODE] Contenido del archivo (raw): ${statusData}`);
      const status = JSON.parse(statusData);
      console.log(`🔍 [GET BOT MODE] status.mode: ${status.mode}, status.active: ${status.active}`);
      
      // CRITICAL: Priorizar el campo 'mode' sobre 'active'
      // Si existe 'mode', usarlo. Si no, migrar desde 'active'
      let mode = null;
      
      if (status.mode && typeof status.mode === 'string') {
        // Formato nuevo: usar 'mode'
        mode = status.mode.trim().toLowerCase();
        console.log(`✅ [GET BOT MODE] Modo encontrado en campo 'mode': "${mode}"`);
      } else if (status.active !== undefined) {
        // Formato antiguo: migrar desde 'active'
        mode = status.active ? 'active' : 'inactive';
        console.log(`⚠️  [GET BOT MODE] Formato antiguo detectado (solo 'active'), migrando: active=${status.active} -> mode="${mode}"`);
        // CRITICAL: Actualizar el archivo al nuevo formato para evitar confusión
        try {
          const updatedStatus = { mode, updatedAt: new Date().toISOString() };
          fs.writeFileSync(statusPath, JSON.stringify(updatedStatus, null, 2), 'utf8');
          console.log(`✅ [GET BOT MODE] Archivo migrado al nuevo formato`);
        } catch (migrateError) {
          console.warn(`⚠️  [GET BOT MODE] No se pudo migrar el archivo: ${migrateError.message}`);
        }
      }
      
      // Validar que el modo sea uno de los valores permitidos
      if (mode && ['inactive', 'test', 'active'].includes(mode)) {
        console.log(`✅ [GET BOT MODE] Modo válido retornado: "${mode}"`);
        return mode;
      } else {
        console.warn(`⚠️  [GET BOT MODE] Modo inválido o no encontrado: "${mode}", usando por defecto: 'inactive' (SEGURIDAD)`);
        return 'inactive'; // Por defecto INACTIVE por seguridad
      }
    }
    console.log(`⚠️  [GET BOT MODE] Archivo no existe, usando por defecto: 'inactive' (SEGURIDAD)`);
    return 'inactive'; // Por defecto INACTIVE por seguridad
  } catch (error) {
    console.error('❌ [GET BOT MODE] Error leyendo estado del bot:', error);
    console.error('   Stack:', error.stack);
    console.warn(`⚠️  [GET BOT MODE] Error en lectura, usando por defecto: 'inactive' (SEGURIDAD)`);
    return 'inactive'; // Por defecto INACTIVE por seguridad si hay error
  }
}

// Función para guardar el estado del bot
function setBotMode(mode) {
  try {
    console.log(`\n💾 ============================================`);
    console.log(`💾 SET BOT MODE - GUARDANDO ESTADO`);
    console.log(`💾 ============================================`);
    console.log(`💾 Modo recibido: "${mode}"`);
    console.log(`💾 Tipo: ${typeof mode}`);
    
    if (!['inactive', 'test', 'active'].includes(mode)) {
      console.error(`❌ Modo inválido: ${mode}. Debe ser 'inactive', 'test', o 'active'`);
      return false;
    }
    
    const statusPath = path.join(__dirname, 'bot_status.json');
    
    // CRITICAL: Limpiar el archivo - solo guardar 'mode', eliminar 'active' si existe
    const statusData = { 
      mode, 
      updatedAt: new Date().toISOString() 
    };
    // NO incluir 'active' para evitar confusión
    
    const jsonData = JSON.stringify(statusData, null, 2);
    console.log(`💾 Datos a escribir (SOLO 'mode', sin 'active'): ${jsonData}`);
    
    fs.writeFileSync(statusPath, jsonData, 'utf8');
    console.log(`💾 Archivo escrito en: ${statusPath}`);
    
    // Verificar que se escribió correctamente
    if (fs.existsSync(statusPath)) {
      const verifyData = fs.readFileSync(statusPath, 'utf8');
      const verifyStatus = JSON.parse(verifyData);
      console.log(`💾 Verificación: archivo existe`);
      console.log(`💾 Contenido verificado: ${verifyData}`);
      console.log(`💾 Modo verificado: ${verifyStatus.mode}`);
      console.log(`💾 ¿Tiene campo 'active'?: ${verifyStatus.active !== undefined ? 'SÍ (PROBLEMA)' : 'NO (correcto)'}`);
      
      // CRITICAL: Si el archivo tiene 'active', eliminarlo
      if (verifyStatus.active !== undefined) {
        console.warn(`⚠️  Archivo tiene campo 'active' residual, limpiando...`);
        const cleanedStatus = { mode: verifyStatus.mode || mode, updatedAt: verifyStatus.updatedAt || new Date().toISOString() };
        fs.writeFileSync(statusPath, JSON.stringify(cleanedStatus, null, 2), 'utf8');
        console.log(`✅ Archivo limpiado - solo tiene 'mode' ahora`);
      }
      
      if (verifyStatus.mode === mode) {
        const modeNames = {
          'inactive': 'INACTIVO',
          'test': 'MODO DE PRUEBAS (solo +525521920710)',
          'active': 'ACTIVO (todos los números)'
        };
        console.log(`✅ Estado del bot actualizado correctamente: ${modeNames[mode]}`);
        console.log(`💾 ============================================\n`);
        return true;
      } else {
        console.error(`❌ Error: El modo guardado (${verifyStatus.mode}) no coincide con el solicitado (${mode})`);
        console.log(`💾 ============================================\n`);
        return false;
      }
    } else {
      console.error(`❌ Error: El archivo no existe después de escribirlo`);
      console.log(`💾 ============================================\n`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error guardando estado del bot:', error);
    console.error('   Stack:', error.stack);
    console.log(`💾 ============================================\n`);
    return false;
  }
}

// Funciones de compatibilidad (deprecadas, usar getBotMode/setBotMode)
function getBotStatus() {
  const mode = getBotMode();
  return mode === 'active' || mode === 'test'; // Activo si está en 'active' o 'test'
}

function setBotStatus(active) {
  return setBotMode(active ? 'active' : 'inactive');
}

// Función de compatibilidad (deprecada, usar getBotMode)
function getTestModeStatus() {
  const mode = getBotMode();
  return mode === 'test';
}

// Función de compatibilidad (deprecada, usar setBotMode)
function setTestModeStatus(active) {
  return setBotMode(active ? 'test' : 'active');
}

// Función para procesar mensajes entrantes (NUEVA ARQUITECTURA BASADA EN INTENTS)
async function processIncomingMessage(senderPhone, incomingMessage, options = {}) {
  // CRITICAL: Verificar estado del bot ANTES de cualquier logging o procesamiento
  // Esto debe ser lo ABSOLUTAMENTE PRIMERO
  console.log(`\n🔒 ============================================`);
  console.log(`🔒 VERIFICACIÓN INMEDIATA - ANTES DE TODO`);
  console.log(`🔒 ============================================`);
  const botMode = getBotMode();
  console.log(`🔒 Modo leído: "${botMode}"`);
  const cleanPhone = senderPhone ? senderPhone.replace(/\D/g, '') : '';
  
  // Verificación inmediata y estricta
  const isInactive = String(botMode).trim().toLowerCase() === 'inactive';
  console.log(`🔒 Comparación: String("${botMode}").trim().toLowerCase() === 'inactive'`);
  console.log(`🔒 Resultado: ${isInactive}`);
  
  if (isInactive) {
    // NO hacer NADA más - terminar inmediatamente
    console.log(`⏸️  ============================================`);
    console.log(`⏸️  BOT INACTIVO - BLOQUEO INMEDIATO`);
    console.log(`⏸️  ============================================`);
    console.log(`⏸️  Mensaje de ${senderPhone} BLOQUEADO`);
    console.log(`⏸️  THROW INMEDIATO - FUNCIÓN TERMINA AQUÍ`);
    console.log(`⏸️  ============================================\n`);
    throw new Error('BOT_INACTIVE_BLOCKED');
  }
  console.log(`✅ Bot no está inactive, continuando...\n`);
  
  console.log(`\n🚨 ============================================`);
  console.log(`🚨 INICIO processIncomingMessage`);
  console.log(`🚨 ============================================`);
  console.log(`🚨 Número recibido: ${senderPhone}`);
  console.log(`🚨 Mensaje: ${incomingMessage}`);
  console.log(`🚨 ============================================\n`);
  
  // CRITICAL: Verificar estado del bot PRIMERO, antes de cualquier otra cosa
  // Modos: 'inactive' (bloquear todo), 'test' (solo +525521920710), 'active' (todos)
  console.log(`\n🔍 ============================================`);
  console.log(`🔍 VERIFICACIÓN DE MODO DEL BOT`);
  console.log(`🔍 ============================================`);
  console.log(`🔍 [BOT MODE CHECK] Modo actual del bot: "${botMode}"`);
  console.log(`🔍 [BOT MODE CHECK] Tipo: ${typeof botMode}`);
  console.log(`🔍 [BOT MODE CHECK] ¿Es 'test'?: ${botMode === 'test'}`);
  console.log(`🔍 [BOT MODE CHECK] ¿Es 'inactive'?: ${botMode === 'inactive'}`);
  console.log(`🔍 [BOT MODE CHECK] ¿Es 'active'?: ${botMode === 'active'}`);
  
  // cleanPhone ya está declarado arriba, solo declarar las constantes de prueba
  const TEST_PHONE_FULL = '525521920710'; // Con código de país
  const TEST_PHONE_SHORT = '5521920710'; // Sin código de país
  
  console.log(`🔍 [BOT MODE CHECK] Número recibido: ${senderPhone}`);
  console.log(`🔍 [BOT MODE CHECK] Número limpio: ${cleanPhone}`);
  console.log(`🔍 [BOT MODE CHECK] TEST_PHONE_FULL: ${TEST_PHONE_FULL}`);
  console.log(`🔍 [BOT MODE CHECK] TEST_PHONE_SHORT: ${TEST_PHONE_SHORT}`);
  console.log(`🔍 ============================================\n`);
  
  // Verificar según el modo - CRITICAL: Esto debe ser lo PRIMERO
  // Validación estricta del modo
  const validModes = ['inactive', 'test', 'active'];
  if (!validModes.includes(botMode)) {
    console.error(`❌ [BOT MODE CHECK] Modo inválido detectado: "${botMode}"`);
    console.error(`❌ [BOT MODE CHECK] Por seguridad, bloqueando mensaje`);
    console.log(`⏸️  ============================================\n`);
    throw new Error('BOT_INVALID_MODE_BLOCKED');
  }
  
  // CRITICAL: Verificación estricta con comparación de strings
  const isInactive2 = String(botMode).trim().toLowerCase() === 'inactive';
  const isTest = String(botMode).trim().toLowerCase() === 'test';
  const isActive = String(botMode).trim().toLowerCase() === 'active';
  
  console.log(`🔍 [BOT MODE CHECK] Comparaciones estrictas:`);
  console.log(`🔍   - isInactive: ${isInactive2}`);
  console.log(`🔍   - isTest: ${isTest}`);
  console.log(`🔍   - isActive: ${isActive}`);
  
  if (isInactive2) {
    console.log(`⏸️  ============================================`);
    console.log(`⏸️  🚫 BOT INACTIVO - BLOQUEO TOTAL (SEGUNDA VERIFICACIÓN)`);
    console.log(`⏸️  ============================================`);
    console.log(`⏸️  Número recibido: ${senderPhone} (limpio: ${cleanPhone})`);
    console.log(`⏸️  ⚠️  NO se procesará`);
    console.log(`⏸️  ⚠️  NO se enviará respuesta`);
    console.log(`⏸️  ⚠️  NO se guardará en historial`);
    console.log(`⏸️  ⚠️  NO se enviará typing indicator`);
    console.log(`⏸️  ⚠️  THROW INMEDIATO - FUNCIÓN TERMINA AQUÍ`);
    console.log(`⏸️  ============================================\n`);
    // CRITICAL: Throw inmediato - NO hacer NADA más
    throw new Error('BOT_INACTIVE_BLOCKED'); // Esto asegura que la función termine
  } else if (isTest) {
    console.log(`🧪 ============================================`);
    console.log(`🧪 MODO DE PRUEBAS ACTIVO - VERIFICANDO NÚMERO`);
    console.log(`🧪 ============================================`);
    
    // Comparación estricta: solo aceptar números exactos
    const exactMatchFull = cleanPhone === TEST_PHONE_FULL;
    const exactMatchShort = cleanPhone === TEST_PHONE_SHORT;
    const endsWithMatch = cleanPhone.length >= 10 && cleanPhone.length <= 12 && cleanPhone.endsWith(TEST_PHONE_SHORT);
    const phoneMatches = exactMatchFull || exactMatchShort || endsWithMatch;
    
    console.log(`🧪 Comparaciones detalladas:`);
    console.log(`🧪   - ${cleanPhone} === ${TEST_PHONE_FULL}? ${exactMatchFull}`);
    console.log(`🧪   - ${cleanPhone} === ${TEST_PHONE_SHORT}? ${exactMatchShort}`);
    console.log(`🧪   - endsWith(${TEST_PHONE_SHORT})? ${endsWithMatch} (length: ${cleanPhone.length})`);
    console.log(`🧪   - phoneMatches: ${phoneMatches}`);
    
    if (!phoneMatches) {
      console.log(`🧪 ============================================`);
      console.log(`🧪 🚫 BLOQUEO TOTAL - MODO DE PRUEBAS ACTIVO`);
      console.log(`🧪 ============================================`);
      console.log(`🧪 Número recibido: ${senderPhone} (limpio: ${cleanPhone})`);
      console.log(`🧪 Número permitido: +525521920710 (${TEST_PHONE_FULL} o ${TEST_PHONE_SHORT})`);
      console.log(`🧪 ⚠️  NO se procesará`);
      console.log(`🧪 ⚠️  NO se enviará respuesta`);
      console.log(`🧪 ⚠️  NO se guardará en historial`);
      console.log(`🧪 ⚠️  NO se enviará typing indicator`);
      console.log(`🧪 ⚠️  RETURN INMEDIATO - FUNCIÓN TERMINA AQUÍ`);
      console.log(`🧪 ============================================\n`);
      // CRITICAL: Return inmediato - NO hacer NADA más
      throw new Error('BOT_TEST_MODE_BLOCKED'); // Esto asegura que la función termine
    } else {
      console.log(`🧪 ✅ MODO DE PRUEBAS: Número permitido (${cleanPhone})`);
      console.log(`🧪 ✅ Continuando procesamiento...`);
      console.log(`🧪 ============================================\n`);
    }
  } else if (botMode === 'active') {
    console.log(`✅ [BOT MODE CHECK] Bot ACTIVO - Procesando mensaje normalmente\n`);
  } else {
    console.log(`⚠️  [BOT MODE CHECK] Modo desconocido: "${botMode}" - Procesando como activo\n`);
  }
  
  // Enviar indicador de "escribiendo..." inmediatamente
  // (solo si no es un click de botón, ya que esos son instantáneos)
  if (!options.isButtonClick) {
    await sendTypingIndicator(senderPhone, 'typing_on');
  }
  
  try {
    const cleanPhone = senderPhone.replace(/\D/g, ''); // Limpiar número
    
    // Import name utilities
    const { getClientName, getClientFirstName } = require('./bot/utils/name-utils');
    
    // Obtener o crear sesión
    let session = sessions.getSession(cleanPhone);
    
    // Check if bot is paused (advisor is handling the conversation)
    if (session.bot_paused_until) {
      const pauseUntil = new Date(session.bot_paused_until);
      const now = new Date();
      
      if (now < pauseUntil) {
        // Bot is still paused - don't process message, just add to history
        console.log(`⏸️  Bot está pausado hasta ${pauseUntil.toISOString()}. Mensaje guardado en historial pero no procesado.`);
        const messageForHistory = options.buttonTitle || incomingMessage;
        sessions.addToHistory(cleanPhone, 'user', messageForHistory);
        return; // Exit without processing
      } else {
        // Pause period has expired - clear the flag and continue processing
        console.log(`▶️  Período de pausa expirado. Bot reanudando procesamiento normal.`);
        sessions.updateSession(cleanPhone, {
          bot_paused_until: null
        });
        // Continue with normal processing below
      }
    }
    
    // Agregar mensaje del usuario al historial (usar el título del botón si es un clic)
    const messageForHistory = options.buttonTitle || incomingMessage;
    sessions.addToHistory(cleanPhone, 'user', messageForHistory);
    
    // Actualizar sesión después de agregar al historial
    session = sessions.getSession(cleanPhone);
    
    // STEP 1: Profile extraction (OPTIMIZED - only if missing info)
    // Only run LLM extraction if we don't have nombre_cliente/nombre_novia or fecha_boda
    // Skip extraction for button clicks to avoid confusion
    let profileJustUpdated = false;
    try {
      const currentNombre = getClientName(session);
      const needsExtraction = !currentNombre || !session.fecha_boda;
      // Don't run extraction for button clicks - it can confuse the extractor
      if (needsExtraction && !options.isButtonClick) {
        const profileData = await extractBrideProfile(session.historial);
        const profileUpdates = {};
        
        // Support both nombre_cliente (new) and nombre_novia (legacy)
        const extractedNombre = profileData.nombre_cliente || profileData.nombre_novia;
        if (extractedNombre && extractedNombre !== currentNombre) {
          profileUpdates.nombre_cliente = extractedNombre;
          // Also set nombre_novia for backward compatibility
          profileUpdates.nombre_novia = extractedNombre;
          console.log(`📝 Perfil: Nombre de cliente actualizado: ${extractedNombre}`);
        }
        
        if (profileData.fecha_boda && profileData.fecha_boda !== session.fecha_boda) {
          profileUpdates.fecha_boda = profileData.fecha_boda;
          console.log(`📝 Perfil: Fecha de boda actualizada: ${profileData.fecha_boda}`);
        }
        
        // Update etapa if we have both nombre and fecha_boda
        if (extractedNombre && profileData.fecha_boda && session.etapa === 'primer_contacto') {
          profileUpdates.etapa = 'interesada';
          console.log(`📝 Perfil: Etapa actualizada: primer_contacto → interesada`);
        }
        
        if (Object.keys(profileUpdates).length > 0) {
          sessions.updateSession(cleanPhone, profileUpdates);
          session = sessions.getSession(cleanPhone); // Refresh session
          
          // Check if we just got nombre (and optionally fecha_boda) for the first time
          // Also check if user has declined to provide fecha_boda
          const hasNombre = getClientName(session) && getClientName(session).trim().length > 0;
          const hasFechaBoda = session.fecha_boda && session.fecha_boda.trim().length > 0;
          const fechaBodaDeclinada = session.fecha_boda_declinada === true;
          
          if (extractedNombre && (profileUpdates.fecha_boda || (hasNombre && (hasFechaBoda || fechaBodaDeclinada)))) {
            profileJustUpdated = true;
            console.log(`📝 Perfil: Se acaban de recolectar nombre${profileUpdates.fecha_boda ? ' y fecha de boda' : ' (fecha declinada o no proporcionada)'}, se mostrará el menú principal`);
          }
        }
      }
    } catch (profileError) {
      console.error('⚠️  Error extrayendo perfil, continuando:', profileError.message);
    }
    
    // STEP 2: Check if user is selecting a slot (if slots are available in session)
    if (session.slots_disponibles && session.slots_disponibles.length > 0) {
      let slotIndex = -1;
      
      // If it's a button click
      if (options.isButtonClick && incomingMessage.startsWith('slot_')) {
        slotIndex = parseInt(incomingMessage.replace('slot_', ''));
      }
      // If it's a number written (only consider small numbers, 1-10)
      else {
        const slotChoice = incomingMessage.match(/^(\d+)$/);
        if (slotChoice) {
          const number = parseInt(slotChoice[1]);
          if (number >= 1 && number <= 10) {
            slotIndex = number - 1;
          }
        }
        
        // If no number match, try to match by time (e.g., "11:00 AM", "2:00 PM", "14:00")
        if (slotIndex === -1) {
          const msgLower = incomingMessage.toLowerCase().trim();
          
          // Try to find matching slot by time
          for (let i = 0; i < session.slots_disponibles.length; i++) {
            const slot = session.slots_disponibles[i];
            const slotTime = slot.time.toLowerCase();
            
            // Extract time components from slot (e.g., "11:00 AM" -> "11:00", "am")
            const timeMatch = slotTime.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/);
            if (timeMatch) {
              const [, hour, minute, ampm] = timeMatch;
              const hourNum = parseInt(hour);
              
              // Try different formats the user might write
              const formats = [
                slotTime, // Exact match: "11:00 am"
                `${hour}:${minute}`, // "11:00"
                `${hour}:${minute} ${ampm || ''}`, // "11:00 am"
                `${hour}:${minute}${ampm || ''}`, // "11:00am"
                `${hour}${minute}`, // "1100"
                `${hour}:${minute} ${ampm?.toUpperCase() || ''}`, // "11:00 AM"
                `${hour}:${minute}${ampm?.toUpperCase() || ''}`, // "11:00AM"
              ];
              
              // Also try 24-hour format
              if (ampm) {
                let hour24 = hourNum;
                if (ampm.toLowerCase() === 'pm' && hourNum !== 12) {
                  hour24 = hourNum + 12;
                } else if (ampm.toLowerCase() === 'am' && hourNum === 12) {
                  hour24 = 0;
                }
                formats.push(`${hour24}:${minute}`, `${String(hour24).padStart(2, '0')}:${minute}`);
              }
              
              // Check if any format matches
              const matches = formats.some(format => {
                const formatLower = format.toLowerCase().trim();
                return msgLower.includes(formatLower) || formatLower.includes(msgLower);
              });
              
              if (matches) {
                slotIndex = i;
                console.log(`✅ Horario reconocido por tiempo: "${incomingMessage}" → ${slot.time} (índice ${i})`);
                break;
              }
            }
            
            // Also try matching just the hour if user says something like "las 11", "a las 2", "11am", "2pm"
            const hourOnlyMatch = msgLower.match(/(?:las?\s*)?(\d{1,2})(?:\s*(?:de\s*la\s*)?(?:mañana|tarde|noche))?(?:\s*(am|pm))?/);
            if (hourOnlyMatch) {
              const [, hourStr, ampm] = hourOnlyMatch;
              const userHour = parseInt(hourStr);
              
              // Extract hour from slot time
              const slotHourMatch = slotTime.match(/(\d{1,2}):/);
              if (slotHourMatch) {
                const slotHour = parseInt(slotHourMatch[1]);
                let slotHour24 = slotHour;
                
                // Convert slot hour to 24h format if needed
                if (slotTime.includes('pm') && slotHour !== 12) {
                  slotHour24 = slotHour + 12;
                } else if (slotTime.includes('am') && slotHour === 12) {
                  slotHour24 = 0;
                }
                
                // Match user hour with slot hour
                if (ampm) {
                  let userHour24 = userHour;
                  if (ampm.toLowerCase() === 'pm' && userHour !== 12) {
                    userHour24 = userHour + 12;
                  } else if (ampm.toLowerCase() === 'am' && userHour === 12) {
                    userHour24 = 0;
                  }
                  
                  if (userHour24 === slotHour24) {
                    slotIndex = i;
                    console.log(`✅ Horario reconocido por hora: "${incomingMessage}" → ${slot.time} (índice ${i})`);
                    break;
                  }
                } else {
                  // No AM/PM specified, try to match
                  if (userHour === slotHour || userHour === slotHour24) {
                    slotIndex = i;
                    console.log(`✅ Horario reconocido por hora (sin AM/PM): "${incomingMessage}" → ${slot.time} (índice ${i})`);
                    break;
                  }
                }
              }
            }
          }
        }
      }
      
      // If user selected a valid slot, create calendar event
      if (slotIndex >= 0 && slotIndex < session.slots_disponibles.length) {
        const selectedSlot = session.slots_disponibles[slotIndex];
        const sessionData = sessions.getSession(cleanPhone);
        
        console.log(`✅ Horario seleccionado: ${selectedSlot.time} (${selectedSlot.start})`);
        console.log(`   Nombre: ${getClientName(sessionData) || 'No disponible'}`);
        console.log(`   Fecha de boda: ${sessionData.fecha_boda || 'No disponible'}`);
        
        const appointmentDateForEvent = sessionData.fecha_cita_solicitada || sessionData.fecha_cita;
        
        // Create or update event in Google Calendar using calendar-service
        const targetCalendarId = citasNuevasCalendarId || process.env.CALENDAR_ID || 'primary';
        
        // CRITICAL: Verificar que el evento azul (spot disponible) todavía existe
        // Si el slot está en la lista, el evento azul debería existir, pero verificamos por seguridad
        if (!selectedSlot.eventId) {
          console.error(`❌ El slot ${selectedSlot.time} no tiene eventId - no se puede verificar disponibilidad`);
          await sendWhatsAppMessage(cleanPhone, `❌ Lo siento, hubo un error al verificar la disponibilidad del horario ${selectedSlot.time}. Por favor, intenta de nuevo.`);
          sessions.addToHistory(cleanPhone, 'assistant', `Error verificando disponibilidad de ${selectedSlot.time}.`);
          return;
        }
        
        console.log(`🔍 Verificando que el evento azul (spot disponible) todavía existe...`);
        console.log(`   Event ID del spot: ${selectedSlot.eventId}`);
        
        // Verificar que el evento azul existe en el calendario "Innovia CDMX"
        if (innoviaCDMXCalendarId) {
          try {
            let auth;
            if (authClient && typeof authClient.getClient === 'function') {
              auth = await authClient.getClient();
            } else {
              auth = authClient;
            }
            
            const spotEvent = await calendar.events.get({
              auth: auth,
              calendarId: innoviaCDMXCalendarId,
              eventId: selectedSlot.eventId
            });
            
            if (!spotEvent.data) {
              console.error(`❌ El evento azul ${selectedSlot.eventId} ya no existe - el spot ya fue tomado`);
              
              // Obtener nuevos slots disponibles
              const newSlots = await getAvailableSlotsService(
                appointmentDateForEvent,
                calendar,
                authClient,
                innoviaCDMXCalendarId,
                null
              );
              
              const availableSlots = newSlots.filter(slot => slot.availableSpots && slot.availableSpots > 0);
              
              if (availableSlots.length === 0) {
                await sendWhatsAppMessage(cleanPhone, `❌ Lo siento, el horario ${selectedSlot.time} ya no está disponible. No hay horarios disponibles para ${appointmentDateForEvent}. Por favor, elige otra fecha.`);
                sessions.addToHistory(cleanPhone, 'assistant', `Horario ${selectedSlot.time} ya no disponible.`);
                return;
              }
              
              // Mostrar nuevos slots disponibles
              const slotButtons = availableSlots.slice(0, 3).map((slot, idx) => {
                const timeText = slot.time.replace(/[^\d:apm\s]/gi, '');
                return {
                  id: `slot_${idx}`,
                  title: timeText
                };
              });
              
              let slotsMessage = `❌ Lo siento, el horario ${selectedSlot.time} ya no está disponible.\n\nEstos son los horarios disponibles ahora:\n`;
              availableSlots.slice(0, 3).forEach((slot, idx) => {
                slotsMessage += `\n${idx + 1}. ${slot.time}`;
              });
              
              if (availableSlots.length > 3) {
                slotsMessage += `\n\n(Se muestran los primeros 3. Hay ${availableSlots.length} horarios disponibles en total)`;
              }
              
              // Actualizar slots disponibles en la sesión
              sessions.updateSession(cleanPhone, {
                slots_disponibles: availableSlots,
                fecha_cita_solicitada: appointmentDateForEvent
              });
              
              await sendWhatsAppMessage(cleanPhone, slotsMessage, { buttons: slotButtons });
              sessions.addToHistory(cleanPhone, 'assistant', slotsMessage);
              return;
            }
            
            console.log(`✅ Evento azul verificado - el spot ${selectedSlot.time} está disponible`);
          } catch (error) {
            if (error.code === 404) {
              console.error(`❌ El evento azul ${selectedSlot.eventId} no existe - el spot ya fue tomado`);
              await sendWhatsAppMessage(cleanPhone, `❌ Lo siento, el horario ${selectedSlot.time} ya no está disponible. Por favor, elige otro horario.`);
              sessions.addToHistory(cleanPhone, 'assistant', `Horario ${selectedSlot.time} ya no disponible.`);
              return;
            }
            console.error(`❌ Error verificando evento azul:`, error.message);
            // Continuar de todas formas - mejor intentar agendar que fallar
          }
        }
        console.log(`📅 Creando evento en Google Calendar...`);
        console.log(`   Fecha de cita: ${appointmentDateForEvent}`);
        console.log(`   Hora inicio: ${selectedSlot.start}`);
        
        let calendarEvent;
        
        // Check if we're rescheduling (have existing eventId)
        if (sessionData.calendar_event_id) {
          console.log(`📅 Reagendando evento existente: ${sessionData.calendar_event_id}`);
          calendarEvent = await updateCalendarEventService(
            sessionData.calendar_event_id,
            getClientName(sessionData) || 'Cliente',
            cleanPhone,
            null, // Email not available in session yet
            selectedSlot.start,
            sessionData.fecha_boda,
            calendar,
            authClient,
            targetCalendarId
          );
          if (calendarEvent) {
            console.log(`✅ Evento reagendado exitosamente en Google Calendar`);
            console.log(`   ID: ${calendarEvent.id}`);
            console.log(`   Link: ${calendarEvent.htmlLink || 'N/A'}`);
          } else {
            console.error(`❌ No se pudo reagendar el evento en Google Calendar`);
          }
        } else {
          console.log(`📅 Creando nuevo evento en calendario: ${targetCalendarId}`);
          console.log(`   citasNuevasCalendarId: ${citasNuevasCalendarId || 'null'}`);
          console.log(`   CALENDAR_ID env: ${process.env.CALENDAR_ID || 'no configurado'}`);
          console.log(`📅 ============================================`);
          console.log(`📅 INTENTANDO CREAR EVENTO EN GOOGLE CALENDAR`);
          console.log(`📅 ============================================`);
          console.log(`📅 Calendario ID a usar: ${targetCalendarId}`);
          console.log(`📅 Cliente: ${getClientName(sessionData) || 'Cliente'}`);
          console.log(`📅 Teléfono: ${cleanPhone}`);
          console.log(`📅 Fecha/Hora: ${selectedSlot.start}`);
          console.log(`📅 Fecha de boda: ${sessionData.fecha_boda || 'No especificada'}`);
          console.log(`📅 ============================================`);
          
          calendarEvent = await createCalendarEventService(
            getClientName(sessionData) || 'Cliente',
            cleanPhone,
            null, // Email not available in session yet
            selectedSlot.start,
            sessionData.fecha_boda,
            calendar,
            authClient,
            targetCalendarId
          );
          
          if (calendarEvent) {
            console.log(`📅 ============================================`);
            console.log(`📅 ✅ EVENTO CREADO CONFIRMADO`);
            console.log(`📅 ============================================`);
            
            // CRITICAL: Eliminar SOLO el evento azul específico del calendario "Innovia CDMX"
            // El evento azul representa el spot disponible que acabamos de usar
            // IMPORTANTE: Solo eliminamos el evento con el eventId específico, NO todos los eventos del horario
            if (selectedSlot.eventId && innoviaCDMXCalendarId) {
              try {
                console.log(`🗑️  Eliminando evento azul (spot disponible) del calendario "Innovia CDMX"...`);
                console.log(`   Event ID a eliminar: ${selectedSlot.eventId}`);
                console.log(`   ⚠️  IMPORTANTE: Solo se eliminará este evento específico, NO otros eventos del calendario`);
                
                let auth;
                if (authClient && typeof authClient.getClient === 'function') {
                  auth = await authClient.getClient();
                } else {
                  auth = authClient;
                }
                
                // CRITICAL: Verificar que el evento existe y es realmente un evento azul (sin nombre)
                // antes de eliminarlo para evitar eliminar eventos incorrectos
                try {
                  const eventToDelete = await calendar.events.get({
                    auth: auth,
                    calendarId: innoviaCDMXCalendarId,
                    eventId: selectedSlot.eventId
                  });
                  
                  // Verificar que el evento no tiene nombre (es un evento azul)
                  if (eventToDelete.data.summary && eventToDelete.data.summary.trim() !== '') {
                    console.warn(`   ⚠️  ADVERTENCIA: El evento ${selectedSlot.eventId} tiene nombre "${eventToDelete.data.summary}"`);
                    console.warn(`   ⚠️  Este NO es un evento azul (sin nombre) - NO se eliminará para evitar pérdida de datos`);
                    console.warn(`   ⚠️  Solo se eliminan eventos azules (sin nombre) que representan spots disponibles`);
                    // NO eliminar este evento - tiene nombre, no es un evento azul
                  } else {
                    // El evento no tiene nombre (es un evento azul) - proceder a eliminarlo
                    console.log(`   ✅ Verificado: El evento es un evento azul (sin nombre) - procediendo a eliminar`);
                    
                    await calendar.events.delete({
                      auth: auth,
                      calendarId: innoviaCDMXCalendarId,
                      eventId: selectedSlot.eventId
                    });
                    
                    console.log(`✅ Evento azul eliminado exitosamente del calendario "Innovia CDMX"`);
                    console.log(`   Event ID eliminado: ${selectedSlot.eventId}`);
                    console.log(`   El spot ${selectedSlot.time} ya no está disponible`);
                    console.log(`   ⚠️  IMPORTANTE: Solo se eliminó este evento específico, otros eventos del calendario NO fueron afectados`);
                  }
                } catch (getError) {
                  if (getError.code === 404) {
                    console.warn(`   ⚠️  El evento ${selectedSlot.eventId} ya no existe - puede que ya haya sido eliminado`);
                  } else {
                    throw getError; // Re-lanzar el error si no es 404
                  }
                }
              } catch (error) {
                console.error(`❌ Error eliminando evento azul del calendario "Innovia CDMX":`, error.message);
                console.error(`   Event ID que se intentó eliminar: ${selectedSlot.eventId}`);
                console.error(`   Esto es crítico - el spot seguirá apareciendo como disponible`);
                // No fallar el proceso completo, pero loggear el error
              }
            } else {
              if (!selectedSlot.eventId) {
                console.warn(`⚠️  No se encontró eventId en el slot seleccionado - no se puede eliminar el evento azul`);
              }
              if (!innoviaCDMXCalendarId) {
                console.warn(`⚠️  No se encontró calendario "Innovia CDMX" - no se puede eliminar el evento azul`);
              }
            }
            console.log(`📅 ID del evento: ${calendarEvent.id}`);
            console.log(`📅 Link directo: ${calendarEvent.htmlLink || 'N/A'}`);
            console.log(`📅 Calendario: ${targetCalendarId}`);
            console.log(`📅 Título: ${calendarEvent.summary}`);
            console.log(`📅 ============================================`);
            console.log(`📅 IMPORTANTE: Verifica que el calendario "${targetCalendarId}" esté compartido con tu cuenta de Google`);
            console.log(`📅 Si usas cuenta de servicio, comparte el calendario con: ${calendarEvent.organizer?.email || 'la cuenta de servicio'}`);
            console.log(`📅 ============================================`);
          } else {
            console.error(`📅 ============================================`);
            console.error(`📅 ❌ ERROR: NO SE PUDO CREAR EL EVENTO`);
            console.error(`📅 ============================================`);
            console.error(`📅 El evento retornó null. Revisa los logs anteriores para ver el error.`);
            console.error(`📅 ============================================`);
            
            // Enviar mensaje de error al usuario
            const nombrePrimero = getClientFirstName(sessionData) || getClientName(sessionData) || 'Cliente';
            await sendWhatsAppMessage(cleanPhone, `❌ Lo siento ${nombrePrimero}, hubo un error al crear tu cita en el calendario. Por favor, intenta de nuevo o contacta directamente con nosotros. 💫`);
            sessions.addToHistory(cleanPhone, 'assistant', 'Error al crear evento en calendario.');
            return; // Salir temprano si no se pudo crear el evento
          }
        }
        
        // Send confirmation (use first name for message, but full name is already saved in calendar)
        // Solo enviar si el evento se creó exitosamente
        if (calendarEvent && calendarEvent.id) {
          const confirmationMessage = getAppointmentConfirmationMessage({
            name: getClientFirstName(sessionData) || getClientName(sessionData) || 'Cliente',
            date: appointmentDateForEvent || 'la fecha seleccionada',
            time: selectedSlot.time,
            calendarLink: calendarEvent?.htmlLink
          });
          
          await sendWhatsAppMessage(cleanPhone, confirmationMessage);
          
          // Add confirmation to history
          sessions.addToHistory(cleanPhone, 'assistant', confirmationMessage);
        }
        
        // If we have pending_delete_old_event, delete it now (moving appointment)
        // IMPORTANT: Only delete if we successfully created the new event AND it's different from the old one
        if (sessionData.pending_delete_old_event && calendarEvent && calendarEvent.id) {
          // Double check: only delete if the new event ID is different from the old one
          if (calendarEvent.id !== sessionData.pending_delete_old_event) {
            const targetCalendarId = citasNuevasCalendarId || process.env.CALENDAR_ID || 'primary';
            try {
              console.log(`🗑️  Eliminando evento anterior (ID: ${sessionData.pending_delete_old_event}) después de crear nueva cita (ID: ${calendarEvent.id})`);
              await deleteCalendarEventService(
                sessionData.pending_delete_old_event,
                calendar,
                authClient,
                targetCalendarId
              );
              console.log(`✅ Evento anterior eliminado (cita movida a nueva fecha)`);
            } catch (error) {
              console.error('❌ Error eliminando evento anterior:', error.message);
              // Don't fail the whole process if deletion fails
            }
          } else {
            console.warn(`⚠️  El nuevo evento tiene el mismo ID que el anterior (${calendarEvent.id}), NO eliminando para evitar pérdida de datos`);
          }
        } else if (sessionData.pending_delete_old_event && !calendarEvent) {
          console.warn('⚠️  No se creó el nuevo evento, NO eliminando evento anterior para evitar pérdida de datos');
        }
        
        // Extract date from selected slot (format: ISO string like "2026-03-04T11:00:00.000Z")
        // Convert to YYYY-MM-DD format for fecha_cita
        // CRITICAL: Parse date components directly from ISO string to avoid timezone shifts
        let fechaCitaFormatted = null;
        if (selectedSlot.start) {
          try {
            // CRITICAL: Extract date components directly from ISO string to avoid timezone issues
            // Don't use new Date() and getFullYear()/getMonth()/getDate() as they can shift the date
            // Example: "2026-03-04T17:30:00-06:00" should be March 4, not March 3
            const dateMatch = selectedSlot.start.match(/^(\d{4})-(\d{2})-(\d{2})T/);
            if (dateMatch) {
              // Extract components directly from string (no timezone conversion)
              const year = dateMatch[1];
              const month = dateMatch[2];
              const day = dateMatch[3];
              fechaCitaFormatted = `${year}-${month}-${day}`;
              console.log(`📅 Fecha de cita formateada: ${fechaCitaFormatted} (desde slot: ${selectedSlot.start})`);
              console.log(`   ⚠️  IMPORTANTE: Fecha extraída directamente del string ISO para evitar cambios de timezone`);
            } else {
              // Fallback: try parsing with Date but extract components carefully
              const slotDate = new Date(selectedSlot.start);
              // Use UTC methods to avoid timezone shifts
              const year = slotDate.getUTCFullYear();
              const month = String(slotDate.getUTCMonth() + 1).padStart(2, '0');
              const day = String(slotDate.getUTCDate()).padStart(2, '0');
              fechaCitaFormatted = `${year}-${month}-${day}`;
              console.log(`📅 Fecha de cita formateada (fallback UTC): ${fechaCitaFormatted} (desde slot: ${selectedSlot.start})`);
            }
          } catch (error) {
            console.error('❌ Error formateando fecha de cita:', error);
            // Fallback to appointmentDateForEvent if available
            if (appointmentDateForEvent) {
              fechaCitaFormatted = appointmentDateForEvent;
              console.log(`📅 Usando fecha de sesión como fallback: ${fechaCitaFormatted}`);
            }
          }
        } else if (appointmentDateForEvent) {
          fechaCitaFormatted = appointmentDateForEvent;
          console.log(`📅 Usando fecha de sesión: ${fechaCitaFormatted}`);
        }
        
        // Si aún no tenemos fecha, intentar extraerla del evento de Google Calendar
        if (!fechaCitaFormatted && calendarEvent && calendarEvent.start) {
          try {
            const eventDate = calendarEvent.start.dateTime 
              ? new Date(calendarEvent.start.dateTime)
              : new Date(calendarEvent.start.date);
            const year = eventDate.getFullYear();
            const month = String(eventDate.getMonth() + 1).padStart(2, '0');
            const day = String(eventDate.getDate()).padStart(2, '0');
            fechaCitaFormatted = `${year}-${month}-${day}`;
            console.log(`📅 Fecha de cita extraída del evento de Google Calendar: ${fechaCitaFormatted}`);
          } catch (error) {
            console.error('❌ Error extrayendo fecha del evento de Google Calendar:', error);
          }
        }
        
        // Track appointment action
        const currentSession = sessions.getSession(cleanPhone);
        const appointmentActions = currentSession.appointmentActions || {};
        if (sessionData.calendar_event_id && calendarEvent?.id) {
          // This is an edit/reschedule
          appointmentActions.edited = true;
        } else {
          // This is a new appointment
          appointmentActions.created = true;
        }
        
        // Update etapa and clear slots, save event ID for rescheduling
        sessions.updateSession(cleanPhone, {
          etapa: 'cita_agendada',
          slots_disponibles: null,
          fecha_cita_solicitada: null,
          fecha_cita: fechaCitaFormatted, // Save formatted date
          calendar_event_id: calendarEvent?.id || null, // Save event ID for rescheduling
          pending_delete_old_event: null, // Clear flag
          fecha_cita_existente: null,
          appointmentActions: appointmentActions
        });
        
        return; // Done, don't process as regular message
      }
    }
    
    
    // STEP 2.6: Check if user is selecting from main menu
    if (options.isButtonClick) {
      if (incomingMessage === 'menu_agendar') {
        // User clicked on "Agendar/Editar Cita" - collect info first, then show submenu
        const targetCalendarId = citasNuevasCalendarId || process.env.CALENDAR_ID || 'primary';
        const calendarDeps = {
          calendarClient: calendar,
          authClient: authClient,
          calendarId: targetCalendarId, // Calendario "CITAS NUEVAS" para guardar citas
          innoviaCDMXCalendarId: innoviaCDMXCalendarId // Calendario "Innovia CDMX" para spots disponibles
        };
        
        // Use agendar handler to collect info (it will ask for name/fecha_boda if missing)
        // Pass a special message to indicate this is from menu_agendar, not cita_nueva
        const agendarHandler = handlers['AGENDAR_NUEVA'];
        const result = await agendarHandler.execute(session, 'menu_agendar_click', calendarDeps);
        
        await sendWhatsAppMessage(cleanPhone, result.reply, result.buttons ? { buttons: result.buttons } : {});
        sessions.addToHistory(cleanPhone, 'assistant', result.reply);
        
        if (result.sessionUpdates && Object.keys(result.sessionUpdates).length > 0) {
          sessions.updateSession(cleanPhone, result.sessionUpdates);
        }
        return;
      } else if (incomingMessage === 'cita_nueva') {
        // User wants to schedule new appointment
        const targetCalendarId = citasNuevasCalendarId || process.env.CALENDAR_ID || 'primary';
        console.log(`📌 Agendando nueva cita:`);
        console.log(`   citasNuevasCalendarId: ${citasNuevasCalendarId || 'null'}`);
        console.log(`   📌 Calendar ID a usar: ${targetCalendarId}`);
        const calendarDeps = {
          calendarClient: calendar,
          authClient: authClient,
          calendarId: targetCalendarId, // Calendario "CITAS NUEVAS" para guardar citas
          innoviaCDMXCalendarId: innoviaCDMXCalendarId // Calendario "Innovia CDMX" para spots disponibles
        };
        const agendarNuevaHandler = handlers['AGENDAR_NUEVA'];
        const result = await agendarNuevaHandler.execute(session, 'quiero agendar', calendarDeps);
        
        await sendWhatsAppMessage(cleanPhone, result.reply, result.buttons ? { buttons: result.buttons } : {});
        sessions.addToHistory(cleanPhone, 'assistant', result.reply);
        
        if (result.sessionUpdates && Object.keys(result.sessionUpdates).length > 0) {
          sessions.updateSession(cleanPhone, result.sessionUpdates);
        }
        return;
      } else if (incomingMessage === 'cita_editar') {
        // User wants to edit/reschedule existing appointment
        const nombreCliente = getClientName(session) || 'Cliente';
        const nombrePrimero = getClientFirstName(session) || nombreCliente;
        
        // First, send a message saying we're searching
        await sendWhatsAppMessage(cleanPhone, `🔍 Buscando cita existente con el nombre de ${nombrePrimero}...`);
        sessions.addToHistory(cleanPhone, 'assistant', `🔍 Buscando cita existente con el nombre de ${nombrePrimero}...`);
        
        // Search for existing appointments by name
        const targetCalendarId = citasNuevasCalendarId || process.env.CALENDAR_ID || 'primary';
        let existingEvent = null;
        
        if (session.calendar_event_id) {
          // We already have the event ID in session, fetch full event details
          try {
            let auth;
            if (authClient && typeof authClient.getClient === 'function') {
              auth = await authClient.getClient();
            } else {
              auth = authClient;
            }
            
            const eventDetails = await calendar.events.get({
              auth: auth,
              calendarId: targetCalendarId,
              eventId: session.calendar_event_id
            });
            
            if (eventDetails.data) {
              const event = eventDetails.data;
              // Use centralized date formatter
              const { parseCalendarDate, formatDateCDMX, formatTimeCDMX } = require('./bot/utils/date-formatter');
              
              const startDateStr = event.start.dateTime || event.start.date;
              const startDate = parseCalendarDate(startDateStr);
              
              existingEvent = {
                id: event.id,
                summary: event.summary,
                start: event.start.dateTime || event.start.date,
                formattedDate: formatDateCDMX(startDate),
                formattedTime: formatTimeCDMX(startDate)
              };
              console.log(`✅ Cita encontrada en sesión: ${existingEvent.id}`);
            }
          } catch (error) {
            console.error('❌ Error obteniendo detalles del evento:', error.message);
          }
        }
        
        if (!existingEvent && nombreCliente && nombreCliente !== 'Cliente') {
          // Search for events by name
          try {
            const foundEvents = await findEventsByNameService(
              nombreCliente,
              calendar,
              authClient,
              targetCalendarId,
              5 // Max 5 results
            );
            
            if (foundEvents.length > 0) {
              // Use the most recent/upcoming event
              existingEvent = foundEvents[0];
              console.log(`✅ Cita encontrada por búsqueda: ${existingEvent.id} - ${existingEvent.summary}`);
              
              // Update session with the found event ID
              sessions.updateSession(cleanPhone, {
                calendar_event_id: existingEvent.id,
                etapa: 'cita_agendada'
              });
            }
          } catch (error) {
            console.error('❌ Error buscando cita:', error.message);
          }
        }
        
        if (existingEvent) {
          // Found an appointment, show details and options
          const reply = `✅ Encontré tu cita agendada:\n\n📅 Fecha: ${existingEvent.formattedDate}\n🕐 Hora: ${existingEvent.formattedTime}\n\n¿Qué te gustaría hacer con tu cita?`;
          
          const buttons = [
            {
              id: 'cita_mover',
              title: 'Mover a Nueva Fecha' // 20 caracteres (máximo)
            },
            {
              id: 'cita_cancelar_desde_editar',
              title: 'Cancelar Cita' // 15 caracteres
            }
          ];
          
          await sendWhatsAppMessage(cleanPhone, reply, { buttons: buttons });
          sessions.addToHistory(cleanPhone, 'assistant', reply);
          
          // Extract date from existing event
          let fechaCitaFromEvent = null;
          if (existingEvent.start) {
            try {
              const eventDate = existingEvent.start.dateTime 
                ? new Date(existingEvent.start.dateTime)
                : new Date(existingEvent.start.date);
              const year = eventDate.getFullYear();
              const month = String(eventDate.getMonth() + 1).padStart(2, '0');
              const day = String(eventDate.getDate()).padStart(2, '0');
              fechaCitaFromEvent = `${year}-${month}-${day}`;
            } catch (error) {
              console.error('❌ Error extrayendo fecha del evento existente:', error);
            }
          }
          
          // Save event info in session for later use
          sessions.updateSession(cleanPhone, {
            calendar_event_id: existingEvent.id,
            etapa: 'cita_agendada',
            fecha_cita_existente: existingEvent.start,
            fecha_cita: fechaCitaFromEvent || session.fecha_cita || null
          });
        } else {
          // No appointment found
          const nombrePrimero = getClientFirstName(session) || nombreCliente;
          await sendWhatsAppMessage(cleanPhone, `❌ No encontré una cita agendada con el nombre de ${nombrePrimero}.\n\n¿Te gustaría agendar una nueva cita?`);
          sessions.addToHistory(cleanPhone, 'assistant', `No encontré una cita agendada con el nombre de ${nombrePrimero}.`);
        }
        return;
      } else if (incomingMessage === 'cita_mover') {
        // User wants to move appointment to new date (delete old + create new)
        if (session.calendar_event_id) {
          // Mark that we need to delete old event after new one is created
          // Clear any previous scheduling state to start fresh
          sessions.updateSession(cleanPhone, {
            pending_delete_old_event: session.calendar_event_id,
            slots_disponibles: null,
            fecha_cita_solicitada: null,
            fecha_cita: null,
            periodo_seleccionado: null,
            slots_medio_dia: null,
            slots_tarde: null,
            calendar_event_id: null // Clear current event ID as we're moving it
          });
          
          // Ask for new date
          await sendWhatsAppMessage(cleanPhone, `¡Por supuesto! 💐\n\n¿Qué día te gustaría reagendar tu cita? Puedes decirme, por ejemplo: "el martes 24 de febrero" o "el 4 de marzo".\n\nUna vez que me digas la fecha, te mostraré los horarios disponibles ✨`);
          sessions.addToHistory(cleanPhone, 'assistant', 'Preguntando por nueva fecha para reagendar.');
        } else {
          await sendWhatsAppMessage(cleanPhone, `No se encontró la cita para mover. ¿Te gustaría agendar una nueva cita?`);
          sessions.addToHistory(cleanPhone, 'assistant', 'No se encontró la cita para mover.');
        }
        return;
      } else if (incomingMessage === 'cita_cancelar_desde_editar') {
        // User wants to cancel appointment from edit menu
        if (session.calendar_event_id) {
          // Delete the calendar event
          const targetCalendarId = citasNuevasCalendarId || process.env.CALENDAR_ID || 'primary';
          try {
            await deleteCalendarEventService(
              session.calendar_event_id,
              calendar,
              authClient,
              targetCalendarId
            );
            console.log(`✅ Evento cancelado eliminado del calendario`);
          } catch (error) {
            console.error('❌ Error eliminando evento cancelado:', error.message);
          }
          
          // Send cancellation confirmation message directly
          const nombrePrimero = getClientFirstName(session);
          const reply = `Entiendo ${nombrePrimero}, gracias por avisarnos 💫\n\n`;
          const reply2 = `Tu cita ha sido cancelada. Si cambias de opinión o quieres agendar para otro día, aquí estaremos para ayudarte ✨\n\n`;
          const reply3 = `¡Esperamos verte pronto! 👰‍♀️`;
          const result = { reply: reply + reply2 + reply3, sessionUpdates: {} };
          
          await sendWhatsAppMessage(cleanPhone, result.reply);
          sessions.addToHistory(cleanPhone, 'assistant', result.reply);
          
          // Track cancellation
          const currentSession = sessions.getSession(cleanPhone);
          const appointmentActions = currentSession.appointmentActions || {};
          appointmentActions.cancelled = true;
          
          // Clear appointment data
          const sessionUpdates = {
            etapa: 'interesada',
            slots_disponibles: null,
            fecha_cita_solicitada: null,
            fecha_cita: null,
            calendar_event_id: null,
            fecha_cita_existente: null,
            appointmentActions: appointmentActions
          };
          sessions.updateSession(cleanPhone, sessionUpdates);
        } else {
          await sendWhatsAppMessage(cleanPhone, `No se encontró la cita para cancelar.`);
          sessions.addToHistory(cleanPhone, 'assistant', 'No se encontró la cita para cancelar.');
        }
        return;
      } else if (incomingMessage === 'cita_cancelar') {
        // User wants to cancel appointment - use CANCELAR_CITA handler
        const targetCalendarId = citasNuevasCalendarId || process.env.CALENDAR_ID || 'primary';
        const calendarDeps = {
          calendarClient: calendar,
          authClient: authClient,
          calendarId: targetCalendarId, // Calendario "CITAS NUEVAS" para guardar citas
          innoviaCDMXCalendarId: innoviaCDMXCalendarId // Calendario "Innovia CDMX" para spots disponibles
        };
        const cancelarCitaHandler = handlers['CANCELAR_CITA'];
        const result = await cancelarCitaHandler.execute(session, 'cancelar', calendarDeps);
        
        await sendWhatsAppMessage(cleanPhone, result.reply, result.buttons ? { buttons: result.buttons } : {});
        sessions.addToHistory(cleanPhone, 'assistant', result.reply);
        
        if (result.sessionUpdates && Object.keys(result.sessionUpdates).length > 0) {
          sessions.updateSession(cleanPhone, result.sessionUpdates);
        }
        return;
      } else if (incomingMessage === 'confirmar_cancelacion') {
        // User confirmed cancellation - proceed with deletion
        if (session.calendar_event_id && session.pending_cancel_confirmation) {
          const targetCalendarId = citasNuevasCalendarId || process.env.CALENDAR_ID || 'primary';
          
          // Get event details before deletion for confirmation message
          let formattedDate = 'la fecha';
          let formattedTime = 'la hora';
          
          try {
            const auth = authClient && typeof authClient.getClient === 'function' 
              ? await authClient.getClient() 
              : authClient;
            
            const eventResponse = await calendar.events.get({
              auth: auth,
              calendarId: targetCalendarId,
              eventId: session.calendar_event_id
            });
            
            const existingEvent = eventResponse.data;
            const eventStart = existingEvent.start.dateTime || existingEvent.start.date;
            
            // Format date and time using centralized formatter
            const { formatDateSpanishCDMX, formatTimeCDMX } = require('./bot/utils/date-formatter');
            formattedDate = formatDateSpanishCDMX(eventStart);
            formattedTime = formatTimeCDMX(eventStart);
          } catch (error) {
            console.warn('⚠️  No se pudo obtener detalles del evento antes de cancelar:', error.message);
          }
          
          // Delete the calendar event
          try {
            await deleteCalendarEventService(
              session.calendar_event_id,
              calendar,
              authClient,
              targetCalendarId
            );
            console.log(`✅ Evento cancelado eliminado del calendario (ID: ${session.calendar_event_id})`);
            
            // Send confirmation message
            const nombrePrimero = getClientFirstName(session);
            const reply = `Entiendo ${nombrePrimero}, gracias por avisarnos 💫\n\n`;
            const reply2 = `Tu cita del ${formattedDate} a las ${formattedTime} ha sido cancelada. Si cambias de opinión o quieres agendar para otro día, aquí estaremos para ayudarte ✨\n\n`;
            const reply3 = `¡Esperamos verte pronto! 👰‍♀️`;
            
            await sendWhatsAppMessage(cleanPhone, reply + reply2 + reply3);
            sessions.addToHistory(cleanPhone, 'assistant', reply + reply2 + reply3);
            
            // Clear appointment data
            sessions.updateSession(cleanPhone, {
              etapa: 'interesada',
              calendar_event_id: null,
              pending_cancel_confirmation: false,
              slots_disponibles: null,
              fecha_cita_solicitada: null,
              fecha_cita: null
            });
          } catch (error) {
            console.error('❌ Error eliminando evento cancelado:', error.message);
            await sendWhatsAppMessage(cleanPhone, `❌ Ocurrió un error al cancelar tu cita. Por favor intenta de nuevo.`);
            sessions.addToHistory(cleanPhone, 'assistant', 'Error al cancelar cita.');
          }
        } else {
          await sendWhatsAppMessage(cleanPhone, `No se encontró la cita para cancelar.`);
          sessions.addToHistory(cleanPhone, 'assistant', 'No se encontró la cita para cancelar.');
        }
        return;
      } else if (incomingMessage === 'menu_info') {
        // User wants to see information submenu
        const infoMenuHandler = require('./bot/handlers/info-menu');
        const result = await infoMenuHandler.execute(session, incomingMessage);
        
        await sendWhatsAppMessage(cleanPhone, result.reply, result.buttons ? { buttons: result.buttons } : {});
        sessions.addToHistory(cleanPhone, 'assistant', result.reply);
        
        if (result.sessionUpdates && Object.keys(result.sessionUpdates).length > 0) {
          sessions.updateSession(cleanPhone, result.sessionUpdates);
        }
        return;
      } else if (incomingMessage === 'menu_asesor') {
        // User wants to contact human - notify admin
        const { getClientFirstName } = require('./bot/utils/name-utils');
        const nombrePrimero = getClientFirstName(session);
        
        // Build simple notification message for admin
        const adminMessage = `🔔 Un cliente quiere comunicarse contigo!\n\n📱 Número del cliente: ${cleanPhone}\n\nPor favor, revisa el WhatsApp de comunicación con clientes para atenderlo.`;
        
        // Send notification to admin
        // Note: WhatsApp Business API only allows sending messages to users who have initiated a conversation
        // OR using message templates. If admin hasn't messaged the bot, this will fail.
        try {
          const adminPhoneClean = ADMIN_PHONE.replace(/\D/g, ''); // Remove non-digits
          const clienteNombre = nombrePrimero || 'Cliente';
          console.log(`\n🔔 ============================================`);
          console.log(`📤 ENVIANDO NOTIFICACIÓN AL ADMIN`);
          console.log(`   Admin Phone (original): ${ADMIN_PHONE}`);
          console.log(`   Admin Phone (cleaned): ${adminPhoneClean}`);
          console.log(`   Cliente: ${clienteNombre} (${cleanPhone})`);
          console.log(`   Mensaje: ${adminMessage.substring(0, 50)}...`);
          console.log(`============================================\n`);
          
          const result = await sendWhatsAppMessage(adminPhoneClean, adminMessage);
          
          console.log(`\n✅ ============================================`);
          console.log(`✅ NOTIFICACIÓN ENVIADA EXITOSAMENTE AL ADMIN`);
          console.log(`   Admin: ${ADMIN_PHONE} (${adminPhoneClean})`);
          console.log(`   Cliente: ${clienteNombre} (${cleanPhone})`);
          console.log(`   Response:`, JSON.stringify(result, null, 2));
          console.log(`============================================\n`);
        } catch (adminError) {
          console.error(`\n❌ ============================================`);
          console.error(`❌ ERROR ENVIANDO NOTIFICACIÓN AL ADMIN`);
          console.error(`   Admin Phone: ${ADMIN_PHONE}`);
          console.error(`   Error Message:`, adminError.message);
          console.error(`   Error Stack:`, adminError.stack);
          
          if (adminError.response) {
            console.error(`   Status: ${adminError.response.status}`);
            console.error(`   Status Text: ${adminError.response.statusText}`);
            if (adminError.response.data) {
              console.error(`   Response Data:`, JSON.stringify(adminError.response.data, null, 2));
              
              // Check if it's a "conversation not started" error
              const errorData = adminError.response.data;
              if (errorData.error?.code === 131047 || 
                  errorData.error?.message?.includes('conversation') ||
                  errorData.error?.message?.includes('not started')) {
                console.warn(`\n⚠️  El admin (${ADMIN_PHONE}) necesita enviar un mensaje al bot primero para recibir notificaciones.`);
                console.warn(`   Alternativa: El admin puede enviar "Hola" al número del bot para iniciar la conversación.`);
              }
            }
          }
          console.error(`============================================\n`);
          // Continue anyway - don't fail the user's request
        }
        
        // Respond to user with custom message
        const greeting = nombrePrimero ? `${nombrePrimero}, ` : '';
        const userReply = `${greeting}😊 Entiendo que quieres hablar con un asesor. En un momento uno de nuestros asesores se pondrá en contacto contigo para ayudarte con lo que necesites 👰‍♀️✨\n\n📧 He enviado una notificación a nuestro equipo.`;
        
        await sendWhatsAppMessage(cleanPhone, userReply);
        sessions.addToHistory(cleanPhone, 'assistant', userReply);
        
        // Pause bot for 10 minutes to allow advisor to respond without bot interference
        // This pause only applies to this specific conversation (session), not others
        const pauseUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now
        sessions.updateSession(cleanPhone, {
          bot_paused_until: pauseUntil.toISOString()
        });
        console.log(`⏸️  Bot pausado para esta conversación hasta ${pauseUntil.toISOString()} (10 minutos) para permitir que el asesor atienda al cliente`);
        
        return;
      } else if (incomingMessage === 'info_catalogo') {
        // User selected catalog from info menu
        const catalogoHandler = handlers['CATALOGO'];
        const result = await catalogoHandler.execute(session, incomingMessage);
        
        await sendWhatsAppMessage(cleanPhone, result.reply);
        sessions.addToHistory(cleanPhone, 'assistant', result.reply);
        
        if (result.sessionUpdates && Object.keys(result.sessionUpdates).length > 0) {
          sessions.updateSession(cleanPhone, result.sessionUpdates);
        }
        return;
      } else if (incomingMessage === 'info_precios') {
        // User selected prices from info menu
        const preciosHandler = handlers['PRECIOS'];
        const result = await preciosHandler.execute(session, incomingMessage);
        
        await sendWhatsAppMessage(cleanPhone, result.reply);
        sessions.addToHistory(cleanPhone, 'assistant', result.reply);
        
        if (result.sessionUpdates && Object.keys(result.sessionUpdates).length > 0) {
          sessions.updateSession(cleanPhone, result.sessionUpdates);
        }
        return;
      } else if (incomingMessage === 'info_ubicacion') {
        // User selected location from info menu
        const ubicacionHandler = handlers['UBICACION'];
        const result = await ubicacionHandler.execute(session, incomingMessage);
        
        await sendWhatsAppMessage(cleanPhone, result.reply);
        sessions.addToHistory(cleanPhone, 'assistant', result.reply);
        
        if (result.sessionUpdates && Object.keys(result.sessionUpdates).length > 0) {
          sessions.updateSession(cleanPhone, result.sessionUpdates);
        }
        return;
      }
    }
    
    // STEP 3: Re-read session after profile extraction (to get updated nombre/fecha_boda)
    session = sessions.getSession(cleanPhone);
    
    // STEP 3.5: If profile was just updated with nombre (and fecha_boda or declined), ALWAYS show main menu
    // This ensures the user sees the appropriate menu after providing their info
    // If user is in scheduling flow (pending_nombre or pending_fecha_boda), show cita submenu
    // Otherwise, show main menu
    const hasNombre = getClientName(session) && getClientName(session).trim().length > 0;
    const hasFechaBoda = session.fecha_boda && session.fecha_boda.trim().length > 0;
    const fechaBodaDeclinada = session.fecha_boda_declinada === true;
    const isInSchedulingFlow = session.pending_nombre === true || session.pending_fecha_boda === true;
    
    if (profileJustUpdated && hasNombre && (hasFechaBoda || fechaBodaDeclinada)) {
      // If user just completed info collection during scheduling flow, show cita submenu
      // BUT: If user is providing appointment date (pending_agendar_fecha), don't show submenu, let it process the date
      if (isInSchedulingFlow && !session.pending_agendar_fecha) {
        console.log(`📌 Perfil recién actualizado durante flujo de agendamiento, mostrando submenú de citas`);
        const citaMenuHandler = require('./bot/handlers/cita-menu');
        const result = await citaMenuHandler.execute(session, incomingMessage);
        
        await sendWhatsAppMessage(cleanPhone, result.reply, result.buttons ? { buttons: result.buttons } : {});
        sessions.addToHistory(cleanPhone, 'assistant', result.reply);
        
        if (result.sessionUpdates && Object.keys(result.sessionUpdates).length > 0) {
          sessions.updateSession(cleanPhone, result.sessionUpdates);
        }
        return; // Don't process further, we've shown the cita submenu
      } else if (!session.pending_agendar_fecha) {
        // User completed info outside scheduling flow, show main menu
        console.log(`📌 Perfil recién actualizado con nombre${hasFechaBoda ? ' y fecha de boda' : ' (fecha declinada)'}, mostrando menú principal`);
        const saludoHandler = handlers['SALUDO'];
        const result = await saludoHandler.execute(session, incomingMessage);
        
        await sendWhatsAppMessage(cleanPhone, result.reply, result.buttons ? { buttons: result.buttons } : {});
        sessions.addToHistory(cleanPhone, 'assistant', result.reply);
        
        if (result.sessionUpdates && Object.keys(result.sessionUpdates).length > 0) {
          sessions.updateSession(cleanPhone, result.sessionUpdates);
        }
        return; // Don't process further, we've shown the menu
      }
    }
    
    // STEP 4: Check if user is in "moving appointment" flow BEFORE classifying
    // STEP 3.5: Use context analyzer for ambiguous responses in specific contexts
    const { analyzeContextualResponse } = require('./bot/utils/context-analyzer');
    
    // Check if user is in a specific context that needs analysis
    if (session.pending_cancel_confirmation && !options.isButtonClick) {
      // User is responding to cancellation confirmation with text (not button)
      const lastBotMessage = session.historial && session.historial.length > 0
        ? session.historial.filter(m => m.role === 'assistant').slice(-1)[0]?.content || ''
        : '';
      
      const analysis = await analyzeContextualResponse(
        incomingMessage,
        'cancellation_confirmation',
        session,
        { lastBotMessage }
      );
      
      if (analysis.action === 'confirm') {
        // User confirmed cancellation - treat as button click
        incomingMessage = 'confirmar_cancelacion';
        options.isButtonClick = true;
        console.log(`📊 Usuario confirmó cancelación con texto, procesando como confirmar_cancelacion`);
      } else if (analysis.action === 'deny') {
        // User denied cancellation - clear flag and show menu
        sessions.updateSession(cleanPhone, {
          pending_cancel_confirmation: false
        });
        const nombrePrimero = getClientFirstName(session);
        const greeting = nombrePrimero ? `¡Perfecto ${nombrePrimero}! ✨` : `¡Perfecto! ✨`;
        await sendWhatsAppMessage(cleanPhone, `${greeting} Tu cita sigue agendada. ¿En qué más puedo ayudarte?`);
        sessions.addToHistory(cleanPhone, 'assistant', `¡Perfecto ${nombrePrimero}! ✨ Tu cita sigue agendada. ¿En qué más puedo ayudarte?`);
        return;
      }
      // If action is 'question' or 'other', continue with normal classification
    }
    
    // If user has pending_delete_old_event, they're providing a new date - but check for gratitude first
    let intent;
    if (session.pending_delete_old_event) {
      // User is in the process of moving an appointment
      // First, check if it's a gratitude message (should be SALUDO, not AGENDAR_NUEVA)
      const msgLower = incomingMessage.toLowerCase();
      const gratitudeKeywords = ['gracias', 'muchas gracias', 'mil gracias', 'súper', 'super', 'perfecto', 'perfecta', 'genial', 'excelente', 'ok', 'okay', 'vale'];
      const isGratitude = gratitudeKeywords.some(kw => msgLower.includes(kw)) && 
                         !msgLower.match(/\d+/) && // No numbers (dates)
                         !msgLower.includes('agendar') && !msgLower.includes('cita') && 
                         !msgLower.includes('disponible') && !msgLower.includes('horario');
      
      if (isGratitude) {
        // It's a gratitude message, not a date - classify as SALUDO
        console.log(`📌 Usuario está agradeciendo (no proporcionando fecha), clasificando como SALUDO`);
        intent = 'SALUDO';
        // Clear pending_delete_old_event since user is not providing a new date
        sessions.updateSession(cleanPhone, { pending_delete_old_event: null });
      } else {
        // Check if message contains a date - if so, process as AGENDAR_NUEVA
        const { extractFechaCitaDeseada } = require('./bot/handlers/agendar');
        const fechaEnMensaje = await extractFechaCitaDeseada(incomingMessage, session.fecha_boda);
        
        if (fechaEnMensaje) {
          // Message contains a date - force AGENDAR_NUEVA
          // Also set pending_agendar_fecha flag so the handler processes the date immediately
          console.log(`📌 Usuario está moviendo cita y proporcionó fecha: ${fechaEnMensaje}, procesando como AGENDAR_NUEVA`);
          sessions.updateSession(cleanPhone, { 
            pending_agendar_fecha: true,
            fecha_cita_solicitada: fechaEnMensaje // Store the date so handler can use it
          });
          intent = 'AGENDAR_NUEVA';
        } else {
          // No date in message yet - classify normally
          intent = await classifyIntent(incomingMessage, session);
          // Only force AGENDAR_NUEVA if it's not clearly a gratitude or other non-scheduling message
          if (intent !== 'AGENDAR_NUEVA' && intent !== 'SALUDO' && !isGratitude) {
            console.log(`📌 Usuario está moviendo cita pero mensaje no tiene fecha clara, forzando AGENDAR_NUEVA`);
            intent = 'AGENDAR_NUEVA';
          }
        }
      }
    } else {
      // Normal flow - classify intent
      intent = await classifyIntent(incomingMessage, session);
    }
    // Guardar el intent en la sesión para métricas
    // Usar historial de intents para mejor tracking
    const currentSession = sessions.getSession(cleanPhone);
    if (!currentSession.intentHistory) {
      currentSession.intentHistory = [];
    }
    currentSession.intentHistory.push(intent);
    // Mantener solo los últimos 100 intents para no llenar memoria
    if (currentSession.intentHistory.length > 100) {
      currentSession.intentHistory = currentSession.intentHistory.slice(-100);
    }
    sessions.updateSession(cleanPhone, { 
      lastIntent: intent,
      intentHistory: currentSession.intentHistory
    });
    
    // STEP 5: Execute handler
    const handler = handlers[intent];
    if (!handler) {
      console.error(`❌ No se encontró handler para intent: ${intent}`);
      // Fallback to escalacion handler
      const fallbackHandler = handlers['OTRO'];
      const result = await fallbackHandler.execute(session, incomingMessage);
      await sendWhatsAppMessage(cleanPhone, result.reply);
      if (Object.keys(result.sessionUpdates).length > 0) {
        sessions.updateSession(cleanPhone, result.sessionUpdates);
      }
      sessions.addToHistory(cleanPhone, 'assistant', result.reply);
      return;
    }
    
    // Prepare calendar dependencies for handlers that need calendar access
    let calendarDeps = null;
    const calendarIntents = ['AGENDAR_NUEVA', 'CAMBIAR_CITA', 'CANCELAR_CITA'];
    if (calendarIntents.includes(intent)) {
      const targetCalendarId = citasNuevasCalendarId || process.env.CALENDAR_ID || 'primary';
      calendarDeps = {
        calendarClient: calendar,
        authClient: authClient,
        calendarId: targetCalendarId, // Calendario "CITAS NUEVAS" para guardar citas
        innoviaCDMXCalendarId: innoviaCDMXCalendarId // Calendario "Innovia CDMX" para spots disponibles
      };
    }
    
    // Execute handler (pass calendarDeps for handlers that need it)
    const result = calendarIntents.includes(intent)
      ? await handler.execute(session, incomingMessage, calendarDeps)
      : await handler.execute(session, incomingMessage);
    
    // STEP 5: Handle pending calendar operations (cancel/update)
    if (result.sessionUpdates && result.sessionUpdates.pending_cancel && session.calendar_event_id) {
      // Delete the calendar event if user cancelled
      const targetCalendarId = citasNuevasCalendarId || process.env.CALENDAR_ID || 'primary';
      try {
        await deleteCalendarEventService(
          session.calendar_event_id,
          calendar,
          authClient,
          targetCalendarId
        );
        console.log(`✅ Evento cancelado eliminado del calendario`);
      } catch (error) {
        console.error('❌ Error eliminando evento cancelado:', error.message);
      }
      // Remove pending_cancel flag and clear calendar_event_id
      delete result.sessionUpdates.pending_cancel;
      result.sessionUpdates.calendar_event_id = null;
    }
    
    // STEP 6: Update session with handler's sessionUpdates
    if (result.sessionUpdates && Object.keys(result.sessionUpdates).length > 0) {
      sessions.updateSession(cleanPhone, result.sessionUpdates);
    }
    
    // Reset consecutive_otro_count if intent is not OTRO
    if (intent !== 'OTRO' && session.consecutive_otro_count) {
      sessions.updateSession(cleanPhone, { consecutive_otro_count: 0 });
    }
    
    // STEP 7: Send reply via Chakra (with buttons if handler returned them)
    const sendOptions = result.buttons ? { buttons: result.buttons } : {};
    await sendWhatsAppMessage(cleanPhone, result.reply, sendOptions);
    
    // Add assistant reply to history
    sessions.addToHistory(cleanPhone, 'assistant', result.reply);
  } catch (error) {
    console.error('❌ Error procesando mensaje:', error.message || error);
    if (error.stack) {
      console.error('   Stack:', error.stack.split('\n').slice(0, 3).join('\n'));
    }
    // No intentar enviar mensaje de error si ya falló el envío
    // (evitar loops infinitos de errores)
  }
}

// Ruta para verificar que el servidor está funcionando
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Bot funcionando correctamente',
    provider: 'Chakra (BSP de WhatsApp)',
    chakraApiKey: CHAKRA_API_KEY ? 'Configurado' : 'No configurado',
    googleCalendarConnected: !!authClient
  });
});

// Ruta de prueba para ver eventos de Google Calendar
app.get('/test-calendar', async (req, res) => {
  try {
    const date = req.query.date || '2026-02-25';
    
    if (!authClient) {
      return res.json({
        error: 'Google Calendar no está conectado',
        message: 'Necesitas autenticarte primero. Reinicia el bot y completa la autenticación OAuth.'
      });
    }

    // Obtener cliente de autenticación
    let auth;
    if (authClient && typeof authClient.getClient === 'function') {
      auth = await authClient.getClient();
    } else {
      auth = authClient;
    }

    const [year, month, day] = date.split('-').map(Number);
    const startOfDay = new Date(year, month - 1, day, 9, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 18, 0, 0);

    // Usar el calendario "CITAS NUEVAS" si está disponible, sino usar el configurado
    const targetCalendarId = citasNuevasCalendarId || process.env.CALENDAR_ID || 'primary';

    const events = await calendar.events.list({
      auth: auth,
      calendarId: targetCalendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      timeZone: 'America/Mexico_City'
    });

    const eventItems = events.data.items || [];
    
    // Procesar eventos
    const eventos = eventItems.map(e => {
      const start = e.start.dateTime ? new Date(e.start.dateTime) : new Date(e.start.date);
      const end = e.end.dateTime ? new Date(e.end.dateTime) : new Date(e.end.date);
      return {
        titulo: e.summary || 'Sin título',
        inicio: start.toLocaleString('es-MX'),
        fin: end.toLocaleString('es-MX'),
        todoElDia: !e.start.dateTime
      };
    });

    // Calcular slots ocupados
    const bookedSlots = [];
    for (let hour = 9; hour < 18; hour++) {
      const slotStart = new Date(year, month - 1, day, hour, 0, 0);
      const slotEnd = new Date(year, month - 1, day, hour + 1, 0, 0);
      
      const isBooked = eventItems.some(e => {
        const eventStart = e.start.dateTime ? new Date(e.start.dateTime) : new Date(e.start.date);
        const eventEnd = e.end.dateTime ? new Date(e.end.dateTime) : new Date(e.end.date);
        return slotStart < eventEnd && slotEnd > eventStart;
      });

      if (isBooked) {
        bookedSlots.push(`${hour}:00 - ${hour + 1}:00`);
      }
    }

    res.json({
      fecha: date,
      totalEventos: eventItems.length,
      eventos: eventos,
      horariosOcupados: bookedSlots,
      horariosDisponibles: 9 - bookedSlots.length,
      mensaje: `El bot encontró ${eventItems.length} evento(s) para el ${date}`
    });

  } catch (error) {
    res.json({
      error: 'Error al consultar Google Calendar',
      mensaje: error.message,
      stack: error.stack
    });
  }
});

// ============================================
// DASHBOARD API ENDPOINTS
// ============================================

// fs y path ya están importados al inicio del archivo
// Usar fs.promises para operaciones asíncronas

// GET /api/stats - Métricas generales
app.get('/api/stats', async (req, res) => {
  try {
    const allSessions = sessions.getAllSessions();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Calcular métricas
    let totalMessages = 0;
    let messagesToday = 0;
    let incomingMessages = 0;
    let outgoingMessages = 0;
    const intentCounts = {};
    let appointmentsTotal = 0;
    let appointmentsToday = 0;
    let appointmentsCreated = 0;
    let appointmentsEdited = 0;
    let appointmentsCancelled = 0;
    
    allSessions.forEach(({ session }) => {
      // Contar mensajes
      const userMessages = session.historial?.filter(m => m.role === 'user') || [];
      const botMessages = session.historial?.filter(m => m.role === 'assistant') || [];
      
      totalMessages += session.historial?.length || 0;
      incomingMessages += userMessages.length;
      outgoingMessages += botMessages.length;
      
      // Mensajes de hoy
      const todayMsgs = session.historial?.filter(msg => {
        const msgDate = new Date(msg.timestamp);
        return msgDate >= todayStart;
      }) || [];
      messagesToday += todayMsgs.length;
      
      // Contar intents - usar historial de intents si existe, sino usar lastIntent
      if (session.intentHistory && Array.isArray(session.intentHistory)) {
        // Contar todos los intents del historial
        session.intentHistory.forEach(intent => {
          if (intent) {
            intentCounts[intent] = (intentCounts[intent] || 0) + 1;
          }
        });
      } else if (session.lastIntent) {
        // Fallback: usar último intent si no hay historial
        intentCounts[session.lastIntent] = (intentCounts[session.lastIntent] || 0) + 1;
      }
      
      // Contar citas agendadas
      if (session.etapa === 'cita_agendada' || session.calendar_event_id) {
        appointmentsTotal++;
        if (session.fecha_cita) {
          const appointmentDate = new Date(session.fecha_cita);
          if (appointmentDate >= todayStart) {
            appointmentsToday++;
          }
        }
      }
      
      // Contar acciones de citas
      if (session.appointmentActions) {
        if (session.appointmentActions.created) appointmentsCreated++;
        if (session.appointmentActions.edited) appointmentsEdited++;
        if (session.appointmentActions.cancelled) appointmentsCancelled++;
      }
    });
    
    res.json({
      totalMessages,
      messagesToday,
      totalConversations: allSessions.length,
      incomingMessages,
      outgoingMessages,
      totalAppointments: appointmentsTotal,
      appointmentsToday,
      appointmentsCreated,
      appointmentsEdited,
      appointmentsCancelled,
      intentDistribution: intentCounts
    });
  } catch (error) {
    console.error('Error en /api/stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/analytics - Métricas completas de analytics
app.get('/api/analytics', async (req, res) => {
  try {
    const allSessions = sessions.getAllSessions();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Determinar periodo según parámetro
    const period = req.query.period || '30d';
    let periodStart, previousPeriodStart, previousPeriodEnd;
    
    if (period === 'today') {
      periodStart = todayStart;
      previousPeriodStart = new Date(todayStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 1);
      previousPeriodEnd = todayStart;
    } else if (period === '7d') {
      periodStart = new Date(todayStart);
      periodStart.setDate(periodStart.getDate() - 7);
      previousPeriodStart = new Date(periodStart);
      previousPeriodStart.setDate(previousPeriodStart.getDate() - 7);
      previousPeriodEnd = periodStart;
    } else if (period === '30d') {
      periodStart = new Date(todayStart);
      periodStart.setMonth(periodStart.getMonth() - 1);
      previousPeriodStart = new Date(periodStart);
      previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
      previousPeriodEnd = periodStart;
    } else if (period === '90d') {
      periodStart = new Date(todayStart);
      periodStart.setMonth(periodStart.getMonth() - 3);
      previousPeriodStart = new Date(periodStart);
      previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 3);
      previousPeriodEnd = periodStart;
    } else {
      periodStart = new Date(todayStart);
      periodStart.setMonth(periodStart.getMonth() - 1);
      previousPeriodStart = new Date(periodStart);
      previousPeriodStart.setMonth(previousPeriodStart.getMonth() - 1);
      previousPeriodEnd = periodStart;
    }
    
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setMonth(monthStart.getMonth() - 1);
    
    // 1. MÉTRICAS DE USO
    const conversationsByDay = {};
    const newConversationsByDay = {}; // Solo conversaciones de usuarios nuevos
    const conversationsByWeek = {};
    const conversationsByMonth = {};
    const userPhones = new Set();
    const newUsers = new Set();
    const returningUsers = new Set();
    const messagesByHour = {};
    const messagesByDay = {};
    const intentCounts = {};
    let totalMessages = 0;
    let totalConversations = 0;
    let totalUserMessages = 0;
    let totalBotMessages = 0;
    
    // 2. RENDIMIENTO DEL BOT (periodo actual)
    let resolvedAutomatically = 0; // Conversaciones que terminaron en cita sin escalamiento
    let escalatedToHuman = 0; // Conversaciones que fueron escaladas
    let successfulAppointments = 0;
    let successfulReschedules = 0;
    let successfulInfoDelivery = 0;
    const responseTimes = []; // Tiempo entre mensaje del usuario y respuesta del bot
    const conversationDurations = []; // Duración total de conversaciones
    
    // Métricas del periodo anterior para comparación
    let previousEscalatedToHuman = 0;
    const previousResponseTimes = [];
    
    // 3. MÉTRICAS DE CONVERSIÓN
    let conversationsWithAppointment = 0;
    let confirmedAppointments = 0;
    
    // 4. MÉTRICAS DE NEGOCIO
    let totalAppointmentsGenerated = 0;
    let appointmentsCancelled = 0;
    let appointmentsRescheduled = 0;
    const appointmentsByDay = {};
    const appointmentsByHour = {};
    
    allSessions.forEach(({ phone, session }) => {
      const lastActivity = new Date(session.ultima_actividad);
      const isInCurrentPeriod = lastActivity >= periodStart && lastActivity <= now;
      const isInPreviousPeriod = lastActivity >= previousPeriodStart && lastActivity < previousPeriodEnd;
      
      // Determinar si es usuario nuevo o recurrente
      const firstMessageDate = session.historial && session.historial.length > 0
        ? new Date(session.historial[0].timestamp)
        : lastActivity;
      
      if (firstMessageDate >= monthStart) {
        newUsers.add(phone);
      } else {
        returningUsers.add(phone);
      }
      
      // Solo procesar sesiones del periodo actual para métricas principales
      if (!isInCurrentPeriod && !isInPreviousPeriod) {
        return; // Saltar sesiones fuera de ambos periodos
      }
      
      if (isInCurrentPeriod) {
        totalConversations++;
      }
      
      // Contar mensajes
      const userMessages = session.historial?.filter(m => m.role === 'user') || [];
      const botMessages = session.historial?.filter(m => m.role === 'assistant') || [];
      totalUserMessages += userMessages.length;
      totalBotMessages += botMessages.length;
      totalMessages += session.historial?.length || 0;
      
      // Conversaciones por día/semana/mes
      const convDate = new Date(session.ultima_actividad);
      const dayKey = convDate.toISOString().split('T')[0];
      const weekKey = `${convDate.getFullYear()}-W${Math.ceil((convDate.getDate() + new Date(convDate.getFullYear(), convDate.getMonth(), 1).getDay()) / 7)}`;
      const monthKey = `${convDate.getFullYear()}-${String(convDate.getMonth() + 1).padStart(2, '0')}`;
      
      conversationsByDay[dayKey] = (conversationsByDay[dayKey] || 0) + 1;
      conversationsByWeek[weekKey] = (conversationsByWeek[weekKey] || 0) + 1;
      conversationsByMonth[monthKey] = (conversationsByMonth[monthKey] || 0) + 1;
      
      // Solo contar conversaciones de usuarios nuevos por día
      // Un usuario nuevo es aquel cuyo primer mensaje fue en el último mes
      // Contamos la conversación nueva en el día de su primer mensaje
      if (isInCurrentPeriod && newUsers.has(phone)) {
        // Usar la fecha del primer mensaje para determinar el día de la conversación nueva
        // (firstMessageDate ya fue calculado arriba)
        const firstMessageDayKey = firstMessageDate.toISOString().split('T')[0];
        
        // Solo contar si el primer mensaje está en el periodo actual
        if (firstMessageDate >= periodStart && firstMessageDate <= now) {
          newConversationsByDay[firstMessageDayKey] = (newConversationsByDay[firstMessageDayKey] || 0) + 1;
        }
      }
      
      // Mensajes por hora y día
      session.historial?.forEach(msg => {
        const msgDate = new Date(msg.timestamp);
        const hourKey = `${dayKey}-${String(msgDate.getHours()).padStart(2, '0')}`;
        messagesByHour[hourKey] = (messagesByHour[hourKey] || 0) + 1;
        messagesByDay[dayKey] = (messagesByDay[dayKey] || 0) + 1;
      });
      
      // Intents
      if (session.intentHistory && Array.isArray(session.intentHistory)) {
        session.intentHistory.forEach(intent => {
          if (intent) {
            intentCounts[intent] = (intentCounts[intent] || 0) + 1;
          }
        });
      } else if (session.lastIntent) {
        intentCounts[session.lastIntent] = (intentCounts[session.lastIntent] || 0) + 1;
      }
      
      // Tiempo de respuesta (tiempo entre mensaje del usuario y respuesta del bot)
      if (session.historial && session.historial.length > 1) {
        for (let i = 0; i < session.historial.length - 1; i++) {
          if (session.historial[i].role === 'user' && session.historial[i + 1].role === 'assistant') {
            const userTime = new Date(session.historial[i].timestamp);
            const botTime = new Date(session.historial[i + 1].timestamp);
            const responseTime = (botTime - userTime) / 1000; // segundos
            if (responseTime > 0 && responseTime < 3600) { // Solo tiempos razonables (< 1 hora)
              const msgDate = new Date(session.historial[i].timestamp);
              if (msgDate >= periodStart && msgDate <= now) {
                responseTimes.push(responseTime);
              } else if (msgDate >= previousPeriodStart && msgDate < previousPeriodEnd) {
                previousResponseTimes.push(responseTime);
              }
            }
          }
        }
      }
      
      // Duración de conversación
      if (session.historial && session.historial.length > 1) {
        const firstMsg = new Date(session.historial[0].timestamp);
        const lastMsg = new Date(session.historial[session.historial.length - 1].timestamp);
        const duration = (lastMsg - firstMsg) / 1000 / 60; // minutos
        if (duration > 0 && duration < 1440) { // Solo duraciones razonables (< 24 horas)
          conversationDurations.push(duration);
        }
      }
      
      // Escalamiento humano
      const hasEscalation = session.intentHistory?.includes('OTRO') || 
                           session.intentHistory?.some(intent => intent && intent.includes('ASESOR'));
      if (hasEscalation) {
        if (isInCurrentPeriod) {
          escalatedToHuman++;
        } else if (isInPreviousPeriod) {
          previousEscalatedToHuman++;
        }
      }
      
      // Citas
      const hasAppointment = session.etapa === 'cita_agendada' || !!session.calendar_event_id;
      if (hasAppointment) {
        conversationsWithAppointment++;
        totalAppointmentsGenerated++;
        
        if (session.appointmentActions?.created) {
          successfulAppointments++;
          confirmedAppointments++;
        }
        
        if (session.appointmentActions?.edited) {
          successfulReschedules++;
          appointmentsRescheduled++;
        }
        
        if (session.appointmentActions?.cancelled) {
          appointmentsCancelled++;
        }
        
        // Citas por día y hora
        if (session.fecha_cita) {
          const aptDate = new Date(session.fecha_cita);
          const aptDayKey = aptDate.toISOString().split('T')[0];
          appointmentsByDay[aptDayKey] = (appointmentsByDay[aptDayKey] || 0) + 1;
          
          // Intentar extraer hora de la cita
          if (session.fecha_cita.includes('T') || session.hora_cita) {
            const hour = session.hora_cita ? parseInt(session.hora_cita.split(':')[0]) : aptDate.getHours();
            const hourKey = `${aptDayKey}-${String(hour).padStart(2, '0')}`;
            appointmentsByHour[hourKey] = (appointmentsByHour[hourKey] || 0) + 1;
          }
        }
      }
      
      // Resolución automática (cita sin escalamiento)
      if (hasAppointment && !hasEscalation) {
        resolvedAutomatically++;
      }
      
      // Entrega exitosa de información (intents de información)
      const hasInfoIntent = session.intentHistory?.some(intent => 
        intent && (intent.includes('INFO') || intent.includes('CATALOGO') || intent.includes('HORARIO'))
      );
      if (hasInfoIntent) {
        successfulInfoDelivery++;
      }
    });
    
    // Calcular promedios
    const avgMessagesPerConversation = totalConversations > 0 ? (totalMessages / totalConversations).toFixed(2) : 0;
    const avgResponseTime = responseTimes.length > 0 
      ? (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1)
      : 0;
    const avgConversationDuration = conversationDurations.length > 0
      ? (conversationDurations.reduce((a, b) => a + b, 0) / conversationDurations.length).toFixed(1)
      : 0;
    
    // Calcular promedio de tiempo de respuesta del periodo anterior
    const previousAvgResponseTime = previousResponseTimes.length > 0
      ? (previousResponseTimes.reduce((a, b) => a + b, 0) / previousResponseTimes.length).toFixed(1)
      : null;
    
    // Calcular tasas
    const fcrRate = totalConversations > 0 
      ? ((resolvedAutomatically / totalConversations) * 100).toFixed(1)
      : 0;
    const escalationRate = totalConversations > 0
      ? ((escalatedToHuman / totalConversations) * 100).toFixed(1)
      : 0;
    
    // Calcular tasa de escalamiento del periodo anterior
    // Necesitamos contar conversaciones del periodo anterior
    let previousTotalConversations = 0;
    allSessions.forEach(({ session }) => {
      const lastActivity = new Date(session.ultima_actividad);
      if (lastActivity >= previousPeriodStart && lastActivity < previousPeriodEnd) {
        previousTotalConversations++;
      }
    });
    const previousEscalationRate = previousTotalConversations > 0
      ? ((previousEscalatedToHuman / previousTotalConversations) * 100).toFixed(1)
      : null;
    const conversionRate = totalConversations > 0
      ? ((conversationsWithAppointment / totalConversations) * 100).toFixed(1)
      : 0;
    const confirmationRate = conversationsWithAppointment > 0
      ? ((confirmedAppointments / conversationsWithAppointment) * 100).toFixed(1)
      : 0;
    
    // Calcular % de éxito en tareas
    const totalAppointmentAttempts = successfulAppointments + (appointmentsCancelled || 0);
    const appointmentSuccessRate = totalAppointmentAttempts > 0
      ? ((successfulAppointments / totalAppointmentAttempts) * 100).toFixed(1)
      : 0;
    
    const totalRescheduleAttempts = successfulReschedules + appointmentsCancelled;
    const rescheduleSuccessRate = totalRescheduleAttempts > 0
      ? ((successfulReschedules / totalRescheduleAttempts) * 100).toFixed(1)
      : 0;
    
    const infoSuccessRate = totalConversations > 0
      ? ((successfulInfoDelivery / totalConversations) * 100).toFixed(1)
      : 0;
    
    // Encontrar picos de uso
    const peakHour = Object.entries(messagesByHour).sort((a, b) => b[1] - a[1])[0];
    const peakDay = Object.entries(messagesByDay).sort((a, b) => b[1] - a[1])[0];
    
    // Encontrar días/horas con más citas
    const peakAppointmentDay = Object.entries(appointmentsByDay).sort((a, b) => b[1] - a[1])[0];
    const peakAppointmentHour = Object.entries(appointmentsByHour).sort((a, b) => b[1] - a[1])[0];
    
    // Top intents
    const topIntents = Object.entries(intentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([intent, count]) => ({ intent, count }));
    
    res.json({
      // 1. MÉTRICAS DE USO
      usage: {
        totalConversations,
        conversationsByDay: Object.entries(conversationsByDay).slice(-30).map(([date, count]) => ({ date, count })),
        newConversationsByDay: Object.entries(newConversationsByDay).slice(-30).map(([date, count]) => ({ date, count })),
        conversationsByWeek: Object.entries(conversationsByWeek).slice(-12).map(([week, count]) => ({ week, count })),
        conversationsByMonth: Object.entries(conversationsByMonth).slice(-12).map(([month, count]) => ({ month, count })),
        newUsers: newUsers.size,
        returningUsers: returningUsers.size,
        avgMessagesPerConversation: parseFloat(avgMessagesPerConversation),
        peakHour: peakHour ? { time: peakHour[0], count: peakHour[1] } : null,
        peakDay: peakDay ? { date: peakDay[0], count: peakDay[1] } : null,
        topIntents
      },
      
      // 2. RENDIMIENTO DEL BOT
      performance: {
        fcrRate: parseFloat(fcrRate),
        escalationRate: parseFloat(escalationRate),
        taskSuccess: {
          appointments: parseFloat(appointmentSuccessRate),
          reschedules: parseFloat(rescheduleSuccessRate),
          infoDelivery: parseFloat(infoSuccessRate)
        },
        avgResponseTime: parseFloat(avgResponseTime),
        avgConversationDuration: parseFloat(avgConversationDuration)
      },
      
      // 3. MÉTRICAS DE CONVERSIÓN
      conversion: {
        conversionRate: parseFloat(conversionRate),
        confirmationRate: parseFloat(confirmationRate),
        conversationsWithAppointment,
        confirmedAppointments
      },
      
      // 4. MÉTRICAS DE NEGOCIO
      business: {
        totalAppointmentsGenerated,
        appointmentsCancelled,
        appointmentsRescheduled,
        peakAppointmentDay: peakAppointmentDay ? { date: peakAppointmentDay[0], count: peakAppointmentDay[1] } : null,
        peakAppointmentHour: peakAppointmentHour ? { time: peakAppointmentHour[0], count: peakAppointmentHour[1] } : null,
        appointmentsByDay: Object.entries(appointmentsByDay).slice(-30).map(([date, count]) => ({ date, count })),
        appointmentsByHour: Object.entries(appointmentsByHour).map(([time, count]) => ({ time, count }))
      }
    });
  } catch (error) {
    console.error('Error en /api/analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/conversations - Lista de conversaciones
app.get('/api/conversations', (req, res) => {
  try {
    const allSessions = sessions.getAllSessions();
    
    const conversations = allSessions.map(({ phone, session }) => {
      const lastMessage = session.historial && session.historial.length > 0
        ? session.historial[session.historial.length - 1]
        : null;
      
      return {
        phone,
        nombre: session.nombre_cliente || session.nombre_novia || null,
        fechaBoda: session.fecha_boda || null,
        etapa: session.etapa || 'primer_contacto',
        lastMessage: lastMessage ? {
          message: lastMessage.content,
          timestamp: lastMessage.timestamp
        } : null,
        lastActivity: session.ultima_actividad,
        messageCount: session.historial?.length || 0,
        hasAppointment: session.etapa === 'cita_agendada' || !!session.calendar_event_id
      };
    });
    
    // Ordenar por última actividad (más reciente primero)
    conversations.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    
    res.json({ conversations });
  } catch (error) {
    console.error('Error en /api/conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/conversations/:phone - Mensajes de una conversación específica
app.get('/api/conversations/:phone', (req, res) => {
  try {
    const phone = req.params.phone.replace(/\D/g, '');
    const session = sessions.getSession(phone);
    
    const messages = (session.historial || []).map(msg => ({
      message: msg.content,
      direction: msg.role === 'user' ? 'incoming' : 'outgoing',
      timestamp: msg.timestamp
    }));
    
    res.json({
      phone,
      nombre: session.nombre_cliente || session.nombre_novia || null,
      fechaBoda: session.fecha_boda || null,
      etapa: session.etapa || 'primer_contacto',
      messages
    });
  } catch (error) {
    console.error('Error en /api/conversations/:phone:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/config - Obtener configuración del bot
app.get('/api/config', async (req, res) => {
  try {
    const businessConfig = JSON.parse(await fs.promises.readFile(path.join(__dirname, 'business_config.json'), 'utf8'));
    
    // Leer configuración de teléfonos (si existe)
    let phoneConfig = { 
      adminPhone: ADMIN_PHONE, 
      botPhone: process.env.PHONE_NUMBER_ID || process.env.DISPLAY_PHONE_NUMBER || '' 
    };
    try {
      const phoneConfigPath = path.join(__dirname, 'phone_config.json');
      if (fs.existsSync(phoneConfigPath)) {
        const phoneConfigData = await fs.promises.readFile(phoneConfigPath, 'utf8');
        const savedConfig = JSON.parse(phoneConfigData);
        phoneConfig = { ...phoneConfig, ...savedConfig };
      }
    } catch (phoneError) {
      console.warn('⚠️  No se pudo leer phone_config.json, usando valores por defecto');
    }
    
    res.json({
      business: businessConfig.negocio,
      horarios: businessConfig.horarios,
      catalogo: businessConfig.catalogo,
      precios: businessConfig.precios,
      adminPhone: phoneConfig.adminPhone || ADMIN_PHONE,
      botPhone: phoneConfig.botPhone || process.env.PHONE_NUMBER_ID || process.env.DISPLAY_PHONE_NUMBER || ''
    });
  } catch (error) {
    console.error('Error en /api/config:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/config - Actualizar configuración del bot
app.put('/api/config', async (req, res) => {
  try {
    const { business, horarios, catalogo, precios, adminPhone, botPhone } = req.body;
    
    // Leer configuración actual
    const currentConfig = JSON.parse(await fs.promises.readFile(path.join(__dirname, 'business_config.json'), 'utf8'));
    
    // Actualizar solo los campos proporcionados
    if (business) {
      currentConfig.negocio = { ...currentConfig.negocio, ...business };
    }
    if (horarios) {
      currentConfig.horarios = { ...currentConfig.horarios, ...horarios };
    }
    if (catalogo) {
      currentConfig.catalogo = { ...currentConfig.catalogo, ...catalogo };
    }
    if (precios) {
      currentConfig.precios = { ...currentConfig.precios, ...precios };
    }
    
    // Guardar configuración actualizada
    await fs.promises.writeFile(
      path.join(__dirname, 'business_config.json'),
      JSON.stringify(currentConfig, null, 2),
      'utf8'
    );
    
    // Guardar configuración de teléfonos en archivo separado
    const phoneConfigPath = path.join(__dirname, 'phone_config.json');
    let phoneConfig = {};
    
    // Leer configuración existente si existe
    try {
      if (fs.existsSync(phoneConfigPath)) {
        const existingData = await fs.promises.readFile(phoneConfigPath, 'utf8');
        phoneConfig = JSON.parse(existingData);
      }
    } catch (readError) {
      console.warn('⚠️  No se pudo leer phone_config.json existente, creando nuevo');
    }
    
    // Actualizar solo los campos proporcionados
    if (adminPhone !== undefined && adminPhone !== null && adminPhone !== '') {
      phoneConfig.adminPhone = adminPhone;
      console.log(`✅ ADMIN_PHONE actualizado a: ${adminPhone}`);
    }
    
    if (botPhone !== undefined && botPhone !== null && botPhone !== '') {
      phoneConfig.botPhone = botPhone;
      console.log(`✅ BOT_PHONE actualizado a: ${botPhone}`);
    }
    
    // Guardar configuración de teléfonos
    await fs.promises.writeFile(
      phoneConfigPath,
      JSON.stringify(phoneConfig, null, 2),
      'utf8'
    );
    
    // Recargar ADMIN_PHONE en memoria si se actualizó
    if (adminPhone && phoneConfig.adminPhone) {
      // Actualizar la variable en memoria para que tome efecto inmediatamente
      ADMIN_PHONE = phoneConfig.adminPhone;
      console.log(`✅ ADMIN_PHONE actualizado en memoria a: ${ADMIN_PHONE}`);
    }
    
    res.json({ success: true, message: 'Configuración actualizada correctamente' });
  } catch (error) {
    console.error('Error en PUT /api/config:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/messages - Obtener todos los mensajes del bot
app.get('/api/messages', async (req, res) => {
  console.log('📥 GET /api/messages - Solicitud recibida');
  try {
    const messagesPath = path.join(__dirname, 'bot_messages.json');
    console.log('   Ruta del archivo:', messagesPath);
    
    // Verificar que el archivo existe
    try {
      await fs.promises.access(messagesPath);
      console.log('   ✅ Archivo encontrado');
    } catch (accessError) {
      console.error('❌ Archivo bot_messages.json no encontrado:', accessError);
      return res.status(404).json({ error: 'Archivo de mensajes no encontrado' });
    }
    
    const fileContent = await fs.promises.readFile(messagesPath, 'utf8');
    console.log('   ✅ Archivo leído, tamaño:', fileContent.length, 'caracteres');
    
    // Verificar que el contenido no esté vacío
    if (!fileContent || fileContent.trim().length === 0) {
      console.error('❌ Archivo bot_messages.json está vacío');
      return res.status(500).json({ error: 'Archivo de mensajes está vacío' });
    }
    
    const messagesData = JSON.parse(fileContent);
    console.log('   ✅ JSON parseado correctamente');
    console.log('   📤 Enviando respuesta JSON');
    res.json(messagesData);
  } catch (error) {
    console.error('❌ Error en /api/messages:', error);
    console.error('   Stack:', error.stack);
    
    // Si es un error de JSON, devolver un mensaje más claro
    if (error instanceof SyntaxError) {
      return res.status(500).json({ 
        error: 'Error parseando JSON del archivo de mensajes',
        details: error.message 
      });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/messages - Actualizar mensajes del bot
app.put('/api/messages', async (req, res) => {
  try {
    const { messages } = req.body;
    
    if (!messages) {
      return res.status(400).json({ error: 'Se requiere el objeto messages' });
    }
    
    const messagesPath = path.join(__dirname, 'bot_messages.json');
    
    // Validar que el JSON sea válido antes de guardar
    const validatedMessages = JSON.parse(JSON.stringify(messages));
    
    // Guardar mensajes actualizados
    await fs.promises.writeFile(
      messagesPath,
      JSON.stringify(validatedMessages, null, 2),
      'utf8'
    );
    
    console.log('✅ Archivo bot_messages.json guardado correctamente');
    
    // Recargar mensajes en memoria para que los cambios se apliquen inmediatamente
    // IMPORTANTE: Usar require cache busting para forzar recarga del módulo
    delete require.cache[require.resolve('./config')];
    const { reloadBotMessages } = require('./config');
    const reloaded = reloadBotMessages();
    
    console.log('✅ Mensajes del bot actualizados y recargados en memoria');
    console.log(`   Verificando mensaje de prueba: ${reloaded?.saludo?.mensajes?.primer_contacto?.texto?.substring(0, 50) || 'N/A'}...`);
    
    res.json({ success: true, message: 'Mensajes actualizados correctamente' });
  } catch (error) {
    console.error('Error en PUT /api/messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/bot-mode - Obtener estado del bot (unificado: inactive, test, active)
app.get('/api/bot-mode', (req, res) => {
  try {
    const mode = getBotMode();
    res.json({ mode });
  } catch (error) {
    console.error('Error en /api/bot-mode:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/bot-mode - Actualizar estado del bot (unificado)
app.put('/api/bot-mode', (req, res) => {
  try {
    const { mode } = req.body;
    
    if (!['inactive', 'test', 'active'].includes(mode)) {
      return res.status(400).json({ error: 'El campo "mode" debe ser "inactive", "test", o "active"' });
    }
    
    const success = setBotMode(mode);
    
    if (success) {
      const messages = {
        'inactive': 'Bot desactivado - No responderá a ningún mensaje',
        'test': 'Modo de pruebas activado - Solo responderá a +525521920710',
        'active': 'Bot activado - Responderá a todos los números'
      };
      res.json({ success: true, mode, message: messages[mode] });
    } else {
      res.status(500).json({ error: 'Error al guardar el estado del bot' });
    }
  } catch (error) {
    console.error('Error en PUT /api/bot-mode:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoints de compatibilidad (deprecados, usar /api/bot-mode)
app.get('/api/bot-status', (req, res) => {
  try {
    const mode = getBotMode();
    res.json({ active: mode !== 'inactive' });
  } catch (error) {
    console.error('Error en /api/bot-status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/bot-status', (req, res) => {
  try {
    const { active } = req.body;
    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'Se requiere el campo "active" (boolean)' });
    }
    const success = setBotMode(active ? 'active' : 'inactive');
    if (success) {
      res.json({ success: true, active, message: `AI Agent ${active ? 'activado' : 'desactivado'} correctamente` });
    } else {
      res.status(500).json({ error: 'Error al guardar el estado del AI Agent' });
    }
  } catch (error) {
    console.error('Error en PUT /api/bot-status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/test-mode-status', (req, res) => {
  try {
    const mode = getBotMode();
    res.json({ active: mode === 'test' });
  } catch (error) {
    console.error('Error en /api/test-mode-status:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/test-mode-status', (req, res) => {
  try {
    const { active } = req.body;
    if (typeof active !== 'boolean') {
      return res.status(400).json({ error: 'Se requiere el campo "active" (boolean)' });
    }
    const success = setBotMode(active ? 'test' : 'active');
    if (success) {
      const message = active 
        ? 'Modo de pruebas activado - El bot solo responderá a +525521920710'
        : 'Modo de pruebas desactivado - El bot responderá a todos';
      res.json({ success: true, active, message });
    } else {
      res.status(500).json({ error: 'Error al guardar el estado del modo de pruebas' });
    }
  } catch (error) {
    console.error('Error en PUT /api/test-mode-status:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/appointments - Citas agendadas
app.get('/api/appointments', async (req, res) => {
  try {
    const allSessions = sessions.getAllSessions();
    const appointments = [];
    
    for (const { phone, session } of allSessions) {
      if (session.etapa === 'cita_agendada' || session.calendar_event_id) {
        appointments.push({
          phone,
          name: session.nombre_cliente || session.nombre_novia || 'Sin nombre',
          fechaBoda: session.fecha_boda || null,
          fechaCita: session.fecha_cita || null,
          calendarEventId: session.calendar_event_id || null,
          createdAt: session.ultima_actividad
        });
      }
    }
    
    // Ordenar por fecha de cita
    appointments.sort((a, b) => {
      if (!a.fechaCita) return 1;
      if (!b.fechaCita) return -1;
      return new Date(a.fechaCita) - new Date(b.fechaCita);
    });
    
    res.json({ appointments });
  } catch (error) {
    console.error('Error en /api/appointments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

// Inicializar Google Calendar antes de iniciar el servidor
initGoogleAuth().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 =====================================`);
    console.log(`✅ Bot de WhatsApp escuchando en puerto ${PORT}`);
    console.log(`📱 Proveedor: Chakra (BSP de WhatsApp)`);
    if (CHAKRA_API_KEY) {
      console.log(`🔑 Chakra API Key: Configurado`);
    } else {
      console.log(`⚠️  Chakra API Key: No configurado`);
    }
    if (authClient) {
      console.log(`📅 Google Calendar: Conectado`);
    } else {
      console.log(`⚠️  Google Calendar: No configurado (usando horarios por defecto)`);
    }
    console.log(`🚀 =====================================\n`);
    console.log('💡 Configuración del webhook en Chakra:');
    console.log(`   URL: https://tu-url-ngrok.com/webhook`);
    console.log(`   Verify Token: ${VERIFY_TOKEN}`);
    console.log(`   Método: POST\n`);
  });
}).catch(error => {
  console.error('❌ Error al inicializar:', error);
  // Iniciar servidor de todas formas, pero sin Google Calendar
  app.listen(PORT, () => {
    console.log(`\n⚠️  Bot iniciado SIN Google Calendar`);
    console.log(`✅ Bot de WhatsApp escuchando en puerto ${PORT}`);
    console.log(`📱 Proveedor: Chakra (BSP de WhatsApp)`);
  });
});

// Manejo de errores
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Error no manejado:', reason);
});
