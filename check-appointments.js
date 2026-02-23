/**
 * Script de diagnóstico para verificar citas en una fecha y hora específica
 * Uso: node check-appointments.js
 */

require('dotenv').config();
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const calendar = google.calendar('v3');
let authClient;
let citasNuevasCalendarId = null;

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
      const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json';
      if (fs.existsSync(credentialsPath)) {
        credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
        console.log('✅ Credenciales de Google cargadas desde archivo local');
      } else {
        throw new Error(`No se encontró archivo de credenciales en ${credentialsPath}`);
      }
    }

    if (!credentials) {
      throw new Error('No se pudieron cargar las credenciales de Google');
    }

    // Verificar si es cuenta de servicio o OAuth
    if (credentials.type === 'service_account') {
      // Es cuenta de servicio - usar GoogleAuth
      authClient = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/calendar']
      });
      console.log('✅ Autenticación de Google inicializada (cuenta de servicio)');
    } else if (credentials.installed || credentials.web) {
      // Es OAuth - usar OAuth2Client
      const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
      const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
      
      // Verificar si ya tenemos token guardado
      const TOKEN_PATH = path.join(__dirname, 'token.json');
      if (fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        oAuth2Client.setCredentials(token);
        authClient = oAuth2Client;
        console.log('✅ Token de OAuth cargado desde archivo');
      } else {
        throw new Error('No se encontró token.json. Ejecuta el flujo de OAuth primero.');
      }
    } else {
      throw new Error('Formato de credenciales no reconocido');
    }
  } catch (error) {
    console.error('❌ Error inicializando Google Auth:', error.message);
    throw error;
  }
}

// Buscar calendario "CITAS NUEVAS"
async function findCitasNuevasCalendar() {
  try {
    if (!authClient) {
      console.warn('⚠️  Google Auth no inicializado');
      return;
    }

    let auth;
    if (authClient && typeof authClient.getClient === 'function') {
      auth = await authClient.getClient();
    } else {
      auth = authClient;
    }

    console.log('🔍 Buscando calendario "CITAS NUEVAS"...');
    
    const calendarList = await calendar.calendarList.list({
      auth: auth,
      minAccessRole: 'writer'
    });

    const citasNuevas = calendarList.data.items.find(cal => {
      if (!cal.summary) return false;
      return cal.summary.toUpperCase().includes('CITAS NUEVAS');
    });

    if (citasNuevas) {
      citasNuevasCalendarId = citasNuevas.id;
      console.log(`✅ Calendario "CITAS NUEVAS" encontrado: ${citasNuevasCalendarId}`);
      console.log(`   Nombre: ${citasNuevas.summary}`);
    } else {
      console.warn('⚠️  No se encontró calendario "CITAS NUEVAS", usando CALENDAR_ID de env o "primary"');
      citasNuevasCalendarId = process.env.CALENDAR_ID || 'primary';
    }
  } catch (error) {
    console.error('❌ Error buscando calendario:', error.message);
    citasNuevasCalendarId = process.env.CALENDAR_ID || 'primary';
  }
}

// Verificar citas en una fecha y hora específica
async function checkAppointments(date, targetHour, targetMinute) {
  try {
    if (!authClient) {
      throw new Error('Google Auth no inicializado');
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

    console.log(`\n📅 Consultando citas para ${date}`);
    console.log(`   Rango: ${startOfDay.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })} - ${endOfDay.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`);
    console.log(`   📌 Calendar ID: ${targetCalendarId}`);

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
    console.log(`\n📋 Total de eventos encontrados: ${eventItems.length}`);

    // Procesar eventos
    const appointments = eventItems.map(e => {
      let start, end;
      
      if (e.start.dateTime) {
        const startStr = e.start.dateTime;
        // Si no tiene offset, agregar -06:00 para CDMX (marzo = horario estándar)
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
        start: start,
        end: end,
        startCDMX: start.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
        endCDMX: end.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
        startTimeCDMX: start.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: true })
      };
    });

    // Filtrar citas que están en el bloque de 2:00 PM (14:00 - 15:30)
    const blockStart = new Date(`${date}T14:00:00-06:00`); // 2:00 PM CDMX
    const blockEnd = new Date(blockStart.getTime() + 90 * 60 * 1000); // 3:30 PM CDMX

    console.log(`\n🔍 Verificando bloque de 2:00 PM - 3:30 PM`);
    console.log(`   Bloque CDMX: ${blockStart.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })} - ${blockEnd.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`);
    console.log(`   Bloque timestamps: [${blockStart.getTime()} - ${blockEnd.getTime()}]`);

    const appointmentsInBlock = appointments.filter(apt => {
      const aptStart = apt.start.getTime();
      const aptEnd = apt.end.getTime();
      const blockStartTime = blockStart.getTime();
      const blockEndTime = blockEnd.getTime();
      
      const overlaps = aptStart < blockEndTime && aptEnd > blockStartTime;
      return overlaps;
    });

    console.log(`\n📊 RESULTADO:`);
    console.log(`   Total de citas en el bloque 2:00 PM - 3:30 PM: ${appointmentsInBlock.length}`);
    
    if (appointmentsInBlock.length > 0) {
      console.log(`\n   Citas encontradas en este bloque:`);
      appointmentsInBlock.forEach((apt, idx) => {
        console.log(`   ${idx + 1}. ${apt.summary}`);
        console.log(`      ID: ${apt.id}`);
        console.log(`      Hora CDMX: ${apt.startTimeCDMX}`);
        console.log(`      Rango: ${apt.startCDMX} - ${apt.endCDMX}`);
        console.log(`      Timestamps: [${apt.start.getTime()} - ${apt.end.getTime()}]`);
      });
    } else {
      console.log(`   ✅ No hay citas en este bloque`);
    }

    // Mostrar todas las citas del día para referencia
    console.log(`\n📋 Todas las citas del día ${date}:`);
    appointments.forEach((apt, idx) => {
      console.log(`   ${idx + 1}. ${apt.summary} - ${apt.startTimeCDMX}`);
    });

    return {
      total: appointments.length,
      inBlock: appointmentsInBlock.length,
      appointments: appointments,
      appointmentsInBlock: appointmentsInBlock
    };

  } catch (error) {
    console.error('❌ Error consultando citas:', error.message);
    console.error('   Stack:', error.stack);
    throw error;
  }
}

// Función principal
async function main() {
  try {
    console.log('🚀 Iniciando verificación de citas...\n');
    
    await initGoogleAuth();
    await findCitasNuevasCalendar();
    
    // Verificar domingo 1 de marzo 2026 a las 2:00 PM
    const date = '2026-03-01';
    const result = await checkAppointments(date, 14, 0);
    
    console.log(`\n✅ Verificación completada`);
    console.log(`   Total citas del día: ${result.total}`);
    console.log(`   Citas en bloque 2:00 PM: ${result.inBlock}`);
    
    if (result.inBlock >= 2) {
      console.log(`\n⚠️  ADVERTENCIA: El bloque tiene ${result.inBlock} citas (máximo permitido: 2)`);
      console.log(`   El bot NO debería mostrar este bloque como disponible`);
    }
    
  } catch (error) {
    console.error('\n❌ Error en script de diagnóstico:', error.message);
    process.exit(1);
  }
}

// Ejecutar
main();
