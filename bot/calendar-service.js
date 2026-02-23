/**
 * Calendar Service
 * 
 * Handles Google Calendar operations.
 * This is the ONLY module that interacts with Google Calendar.
 * 
 * NOTE: This module expects the Google Calendar auth to be initialized
 * in the main bot file. We'll need to pass the calendar client and auth
 * as parameters or access them via a shared module.
 * 
 * For now, we'll create functions that can be called with the necessary
 * dependencies from the main bot file.
 */

const { getBusinessHours } = require('../config');

/**
 * Check if a day is open according to business hours
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {boolean} True if day is open
 */
function isDayOpen(dateString) {
  try {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    
    const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const dayName = dayNames[dayOfWeek];
    
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

/**
 * Get default slots if Google Calendar is not available
 * Los domingos solo hasta las 5:00pm (no se ofrece 6:30pm)
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Array} Array of slot objects
 */
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

/**
 * Get available slots from Google Calendar
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {Object} calendarClient - Google Calendar API client
 * @param {Object} authClient - Google Auth client
 * @param {string} calendarId - Calendar ID to query
 * @param {string} excludeEventId - Optional: Event ID to exclude from count (when moving appointment)
 * @returns {Promise<Array>} Array of available slot objects
 */
async function getAvailableSlots(date, calendarClient, authClient, calendarId, excludeEventId = null) {
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
    const [year, month, day] = date.split('-').map(Number);
    const startOfDay = new Date(year, month - 1, day, 11, 0, 0); // 11:00 AM hora local
    const endOfDay = new Date(year, month - 1, day, 20, 0, 0);   // 8:00 PM hora local

    console.log(`📅 Consultando Google Calendar para ${date}`);
    console.log(`   Rango: ${startOfDay.toLocaleString('es-MX')} - ${endOfDay.toLocaleString('es-MX')}`);
    console.log(`   📌 Calendar ID usado: ${calendarId}`);
    
    // Try to get calendar name for better logging
    try {
      const calendarInfo = await calendarClient.calendars.get({
        auth: auth,
        calendarId: calendarId
      });
      const calendarName = calendarInfo.data.summary || 'Sin nombre';
      console.log(`   📌 Nombre del calendario: "${calendarName}"`);
      if (calendarName.toUpperCase().includes('CITAS NUEVAS')) {
        console.log(`   ✅ Confirmado: Se está usando el calendario "CITAS NUEVAS"`);
      } else {
        console.warn(`   ⚠️  ADVERTENCIA: El calendario usado NO es "CITAS NUEVAS" (es: "${calendarName}")`);
      }
    } catch (error) {
      console.warn(`   ⚠️  No se pudo obtener nombre del calendario: ${error.message}`);
    }

    const events = await calendarClient.events.list({
      auth: auth,
      calendarId: calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      timeZone: 'America/Mexico_City'
    });

    const eventItems = events.data.items || [];
    console.log(`   Eventos encontrados: ${eventItems.length}`);

    // Procesar eventos y convertir a fechas locales
    const bookedEvents = eventItems
      .filter(e => {
        // Exclude the event we're moving (if provided)
        if (excludeEventId && e.id === excludeEventId) {
          console.log(`   ⏭️  Excluyendo evento ${e.id} del conteo (se está moviendo)`);
          return false;
        }
        return true;
      })
      .map(e => {
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
        
        // Contar TODOS los eventos del calendario (todos son citas en este calendario)
        // No filtrar por título porque los eventos se crean solo con el nombre del cliente
        return { start, end, summary: e.summary || 'Sin título', id: e.id };
      });

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
      // Crear bloques interpretando la hora como hora local de CDMX
      // Usar el mismo método que se usa en createCalendarEvent para consistencia
      const blockStart = new Date(year, month - 1, day, blockTime.hour, blockTime.minute, 0);
      const blockEnd = new Date(blockStart.getTime() + 90 * 60 * 1000); // 90 minutos después

      // Contar cuántas citas hay en este bloque
      let citasEnBloque = 0;
      const citasEnEsteBloque = [];
      
      console.log(`   🔍 Verificando bloque ${blockTime.hour}:${String(blockTime.minute).padStart(2, '0')} (${blockStart.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })} - ${blockEnd.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })})`);
      
      bookedEvents.forEach(booked => {
        // Una cita está en el bloque si se solapa con él
        // Convertir todas las fechas a timestamps para comparación precisa
        const bookedStart = new Date(booked.start);
        const bookedEnd = new Date(booked.end);
        
        // Obtener timestamps en milisegundos para comparación precisa
        // Usar los timestamps directos ya que Date objects manejan timezone internamente
        const blockStartTime = blockStart.getTime();
        const blockEndTime = blockEnd.getTime();
        const bookedStartTime = bookedStart.getTime();
        const bookedEndTime = bookedEnd.getTime();
        
        // Check if the booked event overlaps with the block
        // Overlap occurs if: bookedStart < blockEnd AND bookedEnd > blockStart
        // Usar comparación de timestamps para precisión
        const overlaps = bookedStartTime < blockEndTime && bookedEndTime > blockStartTime;
        
        if (overlaps) {
          citasEnBloque++;
          citasEnEsteBloque.push({
            summary: booked.summary,
            start: bookedStart.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
            end: bookedEnd.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' }),
            id: booked.id
          });
          console.log(`   📌 Cita encontrada en bloque ${blockTime.hour}:${String(blockTime.minute).padStart(2, '0')}: ${booked.summary || 'Sin título'}`);
          console.log(`      Inicio: ${bookedStart.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}, Fin: ${bookedEnd.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`);
          console.log(`      Timestamps: bloque [${blockStartTime} - ${blockEndTime}], cita [${bookedStartTime} - ${bookedEndTime}]`);
        }
      });

      // CRITICAL: El bloque está disponible SOLO si tiene MENOS de 2 citas (no <=, sino <)
      // Si tiene exactamente 2 citas, NO debe estar disponible
      if (citasEnBloque < MAX_CITAS_POR_BLOQUE) {
        const availableSpots = MAX_CITAS_POR_BLOQUE - citasEnBloque;
        slots.push({
          time: blockStart.toLocaleTimeString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: true }),
          start: blockStart.toISOString(),
          end: blockEnd.toISOString(),
          availableSpots: availableSpots,
          totalSpots: MAX_CITAS_POR_BLOQUE
        });
        console.log(`   ✅ Bloque ${blockTime.hour}:${String(blockTime.minute).padStart(2, '0')} disponible (${availableSpots}/${MAX_CITAS_POR_BLOQUE} espacios libres, ${citasEnBloque} citas existentes)`);
        if (citasEnEsteBloque.length > 0) {
          console.log(`      Citas en este bloque: ${citasEnEsteBloque.length}`);
        }
      } else {
        console.log(`   ❌ Bloque ${blockTime.hour}:${String(blockTime.minute).padStart(2, '0')} LLENO (${citasEnBloque}/${MAX_CITAS_POR_BLOQUE} citas) - NO DISPONIBLE`);
        console.log(`      Detalles de citas:`);
        citasEnEsteBloque.forEach((cita, idx) => {
          console.log(`        ${idx + 1}. ${cita.summary} (${cita.start} - ${cita.end}) [ID: ${cita.id}]`);
        });
      }
    }

    console.log(`   📊 Total bloques disponibles: ${slots.length}`);
    
    // CRITICAL: Si no hay bloques disponibles, retornar array vacío
    // NO usar getDefaultSlots aquí porque eso mostraría slots que no respetan la regla de máximo 2 citas
    // getDefaultSlots solo debe usarse cuando NO se puede consultar Google Calendar (fallback por error de conexión)
    if (slots.length === 0) {
      console.warn('   ⚠️  No hay bloques disponibles (todos los bloques tienen 2 citas o más)');
      console.warn('   ⚠️  Retornando array vacío - el usuario debe elegir otra fecha');
      return [];
    }
    
    return slots;
  } catch (error) {
    console.error('❌ Error al consultar Google Calendar:', error.message);
    console.error('   Stack:', error.stack);
    console.warn('⚠️  Usando horarios por defecto');
    return getDefaultSlots(date);
  }
}

/**
 * Verifica si un slot específico aún está disponible antes de crear la cita
 * Esto previene que se agenden más de MAX_CITAS_POR_BLOQUE citas en el mismo bloque
 * @param {string} slotStart - Start time of the slot in ISO format (e.g., "2026-03-18T11:00:00.000Z")
 * @param {Object} calendarClient - Google Calendar API client
 * @param {Object} authClient - Google Auth client
 * @param {string} calendarId - Calendar ID to check
 * @param {string} excludeEventId - Event ID to exclude from count (optional, for rescheduling)
 * @returns {Promise<{available: boolean, currentCount: number, maxCount: number}>}
 */
async function isSlotAvailable(slotStart, calendarClient, authClient, calendarId, excludeEventId = null) {
  try {
    const MAX_CITAS_POR_BLOQUE = 2;
    
    if (!authClient) {
      console.warn('⚠️  Google Auth no inicializado, asumiendo slot disponible');
      return { available: true, currentCount: 0, maxCount: MAX_CITAS_POR_BLOQUE };
    }

    // Obtener cliente de autenticación
    let auth;
    if (authClient && typeof authClient.getClient === 'function') {
      auth = await authClient.getClient();
    } else {
      auth = authClient;
    }

    // Parsear la fecha/hora del slot
    const slotDate = new Date(slotStart);
    const year = slotDate.getFullYear();
    const month = slotDate.getMonth() + 1;
    const day = slotDate.getDate();
    const hour = slotDate.getHours();
    const minute = slotDate.getMinutes();

    // Calcular el bloque de 90 minutos
    const blockStart = new Date(year, month - 1, day, hour, minute, 0);
    const blockEnd = new Date(blockStart.getTime() + 90 * 60 * 1000); // 90 minutos después

    // Obtener eventos del día
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59);

    const events = await calendarClient.events.list({
      auth: auth,
      calendarId: calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      timeZone: 'America/Mexico_City'
    });

    const eventItems = events.data.items || [];

    // Contar citas en este bloque específico
    let citasEnBloque = 0;
    
    eventItems.forEach(e => {
      // Excluir el evento que se está moviendo (si es rescheduling)
      if (excludeEventId && e.id === excludeEventId) {
        return;
      }

      let bookedStart, bookedEnd;
      
      if (e.start.dateTime) {
        bookedStart = new Date(e.start.dateTime);
        bookedEnd = new Date(e.end.dateTime);
      } else if (e.start.date) {
        bookedStart = new Date(e.start.date + 'T00:00:00');
        bookedEnd = new Date(e.end.date + 'T23:59:59');
      } else {
        return;
      }

      // Verificar si se solapa con el bloque
      const overlaps = bookedStart < blockEnd && bookedEnd > blockStart;
      
      if (overlaps) {
        citasEnBloque++;
        console.log(`   📌 Verificación de disponibilidad: Cita encontrada en bloque (${hour}:${String(minute).padStart(2, '0')}): ${e.summary || 'Sin título'}`);
      }
    });

    const available = citasEnBloque < MAX_CITAS_POR_BLOQUE;
    
    console.log(`   🔍 Verificación de slot ${hour}:${String(minute).padStart(2, '0')}: ${citasEnBloque}/${MAX_CITAS_POR_BLOQUE} citas - ${available ? '✅ DISPONIBLE' : '❌ LLENO'}`);

    return {
      available,
      currentCount: citasEnBloque,
      maxCount: MAX_CITAS_POR_BLOQUE
    };
  } catch (error) {
    console.error('❌ Error verificando disponibilidad del slot:', error.message);
    // En caso de error, asumir disponible para no bloquear el proceso
    return { available: true, currentCount: 0, maxCount: 2 };
  }
}

/**
 * Create calendar event in Google Calendar
 * @param {string} name - Client's full name
 * @param {string} phone - Client's phone number
 * @param {string} email - Client's email (optional)
 * @param {string} dateStart - Start date/time in ISO format
 * @param {string} fechaBoda - Wedding date (optional, for description)
 * @param {Object} calendarClient - Google Calendar API client
 * @param {Object} authClient - Google Auth client
 * @param {string} calendarId - Calendar ID to create event in
 * @returns {Promise<Object|null>} Created event object or null
 */
async function createCalendarEvent(name, phone, email, dateStart, fechaBoda, calendarClient, authClient, calendarId) {
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
    // IMPORTANTE: dateStart viene como ISO string (puede estar en UTC)
    // Necesitamos interpretarlo como hora local de CDMX
    let startDate;
    if (typeof dateStart === 'string' && dateStart.includes('T')) {
      // Si viene como ISO string, parsearlo y tratarlo como hora local de CDMX
      // Ejemplo: "2026-03-18T12:30:00.000Z" -> interpretar como 12:30 PM hora de CDMX
      const dateMatch = dateStart.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
      if (dateMatch) {
        const [, year, month, day, hour, minute, second] = dateMatch.map(Number);
        // Crear fecha en zona horaria local de CDMX (no UTC)
        startDate = new Date(year, month - 1, day, hour, minute, second || 0);
        console.log(`   📅 Fecha parseada como hora local CDMX: ${startDate.toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}`);
      } else {
        startDate = new Date(dateStart);
      }
    } else {
      startDate = new Date(dateStart);
    }
    
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
    } else {
      description += `FECHA DE BODA: No definido por el cliente\n`;
    }
    description += `TELEFONO: ${formatPhone(phone)}\n`;
    if (email) {
      description += `EMAIL: ${email}\n`;
    }
    description += '\n*Cita creada por Calendar bot*';
    
    // Formatear fecha/hora en formato RFC3339 para CDMX
    // Necesitamos crear la fecha en formato ISO pero interpretada como hora local de CDMX
    const formatDateTimeForCDMX = (date) => {
      // Obtener componentes de la fecha en hora local
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      // Formato: YYYY-MM-DDTHH:MM:SS (sin Z, para que Google Calendar lo interprete con timeZone)
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };
    
    const startDateTime = formatDateTimeForCDMX(startDate);
    const endDateTime = formatDateTimeForCDMX(endDate);
    
    console.log(`   🕐 Hora de inicio (CDMX): ${startDate.toLocaleString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: true })}`);
    console.log(`   🕐 Hora de fin (CDMX): ${endDate.toLocaleString('es-MX', { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', hour12: true })}`);
    console.log(`   🕐 DateTime string enviado: ${startDateTime} (timeZone: America/Mexico_City)`);
    
    const event = {
      summary: eventSummary,
      description: description,
      start: {
        dateTime: startDateTime,
        timeZone: 'America/Mexico_City'
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'America/Mexico_City'
      },
      attendees: email ? [{ email: email }] : []
    };

    console.log(`   📅 ============================================`);
    console.log(`   📅 CREANDO EVENTO EN GOOGLE CALENDAR`);
    console.log(`   📅 ============================================`);
    console.log(`   📅 Calendario ID: ${calendarId}`);
    
    // Obtener información del calendario para verificar
    try {
      const calendarInfo = await calendarClient.calendars.get({
        auth: auth,
        calendarId: calendarId
      });
      const calendarName = calendarInfo.data.summary || 'Sin nombre';
      console.log(`   📅 Nombre del calendario: "${calendarName}"`);
      console.log(`   📅 Email del calendario: ${calendarInfo.data.id || 'N/A'}`);
    } catch (calError) {
      console.warn(`   ⚠️  No se pudo obtener información del calendario: ${calError.message}`);
    }
    
    console.log(`   📝 Título del evento: ${eventSummary}`);
    console.log(`   🕐 Inicio: ${startDate.toLocaleString('es-MX')}`);
    console.log(`   🕐 Fin: ${endDate.toLocaleString('es-MX')}`);
    console.log(`   📅 ============================================`);
    
    const createdEvent = await calendarClient.events.insert({
      auth: auth,
      calendarId: calendarId,
      resource: event
    });

    if (createdEvent && createdEvent.data) {
      console.log(`   ✅ ============================================`);
      console.log(`   ✅ EVENTO CREADO EXITOSAMENTE`);
      console.log(`   ✅ ============================================`);
      console.log(`   ✅ ID del evento: ${createdEvent.data.id}`);
      console.log(`   ✅ Link: ${createdEvent.data.htmlLink || 'N/A'}`);
      console.log(`   ✅ Calendario: ${calendarId}`);
      console.log(`   ✅ Título: ${createdEvent.data.summary}`);
      console.log(`   ✅ Inicio: ${createdEvent.data.start?.dateTime || createdEvent.data.start?.date}`);
      console.log(`   ✅ ============================================`);
      return createdEvent.data;
    }

    console.error(`   ❌ ERROR: createdEvent.data es null o undefined`);
    return null;
  } catch (error) {
    console.error('❌ Error creando evento en Google Calendar:', error.message);
    console.error('   Stack:', error.stack);
    return null;
  }
}

/**
 * Update an existing calendar event
 * @param {string} eventId - ID of the event to update
 * @param {string} name - Client's full name
 * @param {string} phone - Client's phone number
 * @param {string} email - Client's email (optional)
 * @param {string} dateStart - New start date/time in ISO format
 * @param {string} fechaBoda - Wedding date (optional, for description)
 * @param {Object} calendarClient - Google Calendar API client
 * @param {Object} authClient - Google Auth client
 * @param {string} calendarId - Calendar ID where the event exists
 * @returns {Promise<Object|null>} Updated event object or null
 */
async function updateCalendarEvent(eventId, name, phone, email, dateStart, fechaBoda, calendarClient, authClient, calendarId) {
  try {
    if (!authClient || !eventId) {
      console.warn('⚠️  Google Auth no inicializado o eventId faltante, no se puede actualizar evento');
      return null;
    }

    // Obtener cliente de autenticación
    let auth;
    if (authClient && typeof authClient.getClient === 'function') {
      auth = await authClient.getClient();
    } else {
      auth = authClient;
    }
    
    // Calcular fecha de fin: siempre 90 minutos después del inicio
    // IMPORTANTE: dateStart viene como ISO string (puede estar en UTC)
    // Necesitamos interpretarlo como hora local de CDMX
    let startDate;
    if (typeof dateStart === 'string' && dateStart.includes('T')) {
      // Si viene como ISO string, parsearlo y tratarlo como hora local de CDMX
      const dateMatch = dateStart.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
      if (dateMatch) {
        const [, year, month, day, hour, minute, second] = dateMatch.map(Number);
        // Crear fecha en zona horaria local de CDMX (no UTC)
        startDate = new Date(year, month - 1, day, hour, minute, second || 0);
      } else {
        startDate = new Date(dateStart);
      }
    } else {
      startDate = new Date(dateStart);
    }
    
    const endDate = new Date(startDate.getTime() + 90 * 60 * 1000); // 90 minutos
    
    // Formatear teléfono
    const formatPhone = (phoneNum) => {
      const cleaned = phoneNum.replace(/\D/g, '');
      if (cleaned.length >= 10) {
        const last10 = cleaned.slice(-10);
        return `${last10.slice(0, 2)} ${last10.slice(2, 5)} ${last10.slice(5)}`;
      }
      return cleaned;
    };
    
    // Formatear fecha de boda
    const formatFechaBoda = (fecha) => {
      if (!fecha) return 'No especificada';
      try {
        if (fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
          const [year, month, day] = fecha.split('-');
          return `${day}/${month}/${year}`;
        }
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
    
    // Descripción
    let description = '';
    if (fechaBoda) {
      description += `FECHA DE BODA: ${formatFechaBoda(fechaBoda)}\n`;
    } else {
      description += `FECHA DE BODA: No definido por el cliente\n`;
    }
    description += `TELEFONO: ${formatPhone(phone)}\n`;
    if (email) {
      description += `EMAIL: ${email}\n`;
    }
    description += '\n*Cita reagendada por Calendar bot*';
    
    // Formatear fecha/hora en formato RFC3339 para CDMX
    const formatDateTimeForCDMX = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    };
    
    const startDateTime = formatDateTimeForCDMX(startDate);
    const endDateTime = formatDateTimeForCDMX(endDate);
    
    const event = {
      summary: eventSummary,
      description: description,
      start: {
        dateTime: startDateTime,
        timeZone: 'America/Mexico_City'
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'America/Mexico_City'
      },
      attendees: email ? [{ email: email }] : []
    };

    console.log(`   📅 Actualizando evento ${eventId} en calendario ID: ${calendarId}`);
    console.log(`   📝 Nuevo título: ${eventSummary}`);
    console.log(`   🕐 Nuevo inicio: ${startDate.toLocaleString('es-MX')}`);
    
    const updatedEvent = await calendarClient.events.update({
      auth: auth,
      calendarId: calendarId,
      eventId: eventId,
      resource: event
    });

    if (updatedEvent && updatedEvent.data) {
      console.log(`✅ Evento actualizado exitosamente en Google Calendar`);
      console.log(`   ID: ${updatedEvent.data.id}`);
      console.log(`   Link: ${updatedEvent.data.htmlLink || 'N/A'}`);
      return updatedEvent.data;
    }

    return null;
  } catch (error) {
    console.error('❌ Error actualizando evento en Google Calendar:', error.message);
    console.error('   Stack:', error.stack);
    return null;
  }
}

/**
 * Delete a calendar event
 * @param {string} eventId - ID of the event to delete
 * @param {Object} calendarClient - Google Calendar API client
 * @param {Object} authClient - Google Auth client
 * @param {string} calendarId - Calendar ID where the event exists
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deleteCalendarEvent(eventId, calendarClient, authClient, calendarId) {
  try {
    if (!authClient || !eventId) {
      console.warn('⚠️  Google Auth no inicializado o eventId faltante, no se puede eliminar evento');
      return false;
    }

    // Obtener cliente de autenticación
    let auth;
    if (authClient && typeof authClient.getClient === 'function') {
      auth = await authClient.getClient();
    } else {
      auth = authClient;
    }

    console.log(`   🗑️  Eliminando evento ${eventId} del calendario ${calendarId}`);
    
    await calendarClient.events.delete({
      auth: auth,
      calendarId: calendarId,
      eventId: eventId
    });

    console.log(`✅ Evento eliminado exitosamente del Google Calendar`);
    return true;
  } catch (error) {
    console.error('❌ Error eliminando evento del Google Calendar:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
}

/**
 * Find calendar events by client name
 * @param {string} clientName - Client's name to search for
 * @param {Object} calendarClient - Google Calendar API client
 * @param {Object} authClient - Google Auth client
 * @param {string} calendarId - Calendar ID to search in
 * @param {number} maxResults - Maximum number of results to return (default: 10)
 * @returns {Promise<Array>} Array of event objects matching the name
 */
async function findEventsByName(clientName, calendarClient, authClient, calendarId, maxResults = 10) {
  try {
    if (!authClient || !clientName) {
      console.warn('⚠️  Google Auth no inicializado o nombre faltante, no se puede buscar eventos');
      return [];
    }

    // Obtener cliente de autenticación
    let auth;
    if (authClient && typeof authClient.getClient === 'function') {
      auth = await authClient.getClient();
    } else {
      auth = authClient;
    }

    console.log(`🔍 Buscando eventos con nombre: "${clientName}" en calendario ${calendarId}`);
    
    // Search for events in the next 6 months
    const now = new Date();
    const sixMonthsLater = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000);
    
    const events = await calendarClient.events.list({
      auth: auth,
      calendarId: calendarId,
      timeMin: now.toISOString(),
      timeMax: sixMonthsLater.toISOString(),
      maxResults: maxResults,
      singleEvents: true,
      orderBy: 'startTime',
      q: clientName, // Search query - searches in summary and description
      timeZone: 'America/Mexico_City'
    });

    const eventItems = events.data.items || [];
    
    // Filter events that match the name in summary (title)
    const matchingEvents = eventItems.filter(event => {
      const summary = (event.summary || '').toLowerCase();
      const nameLower = clientName.toLowerCase();
      // Check if the name appears in the event title
      return summary.includes(nameLower) || nameLower.includes(summary);
    });

    console.log(`   Eventos encontrados: ${matchingEvents.length}`);
    
    return matchingEvents.map(event => {
      // Parse start and end dates - IMPORTANTE: interpretar como hora de CDMX
      let startDate, endDate;
      
      if (event.start.dateTime) {
        // Parsear directamente con new Date() - JavaScript manejará el timezone offset correctamente
        // Luego usaremos toLocaleTimeString con timeZone para formatear en CDMX
        startDate = new Date(event.start.dateTime);
      } else {
        startDate = new Date(event.start.date + 'T00:00:00');
      }
      
      if (event.end.dateTime) {
        // Parsear directamente con new Date() - JavaScript manejará el timezone offset correctamente
        endDate = new Date(event.end.dateTime);
      } else {
        endDate = new Date(event.end.date + 'T23:59:59');
      }
      
      // Use centralized date formatter
      const { formatDateCDMX } = require('./utils/date-formatter');
      const formatDate = formatDateCDMX;
      
      // Use centralized date formatter
      const { formatTimeCDMX } = require('./utils/date-formatter');
      const formatTime = formatTimeCDMX;
      
      return {
        id: event.id,
        summary: event.summary,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        startDate: startDate,
        endDate: endDate,
        formattedDate: formatDate(startDate),
        formattedTime: formatTime(startDate),
        description: event.description || '',
        htmlLink: event.htmlLink || ''
      };
    });
  } catch (error) {
    console.error('❌ Error buscando eventos por nombre:', error.message);
    console.error('   Stack:', error.stack);
    return [];
  }
}

module.exports = {
  getAvailableSlots,
  isDayOpen,
  getDefaultSlots,
  isSlotAvailable,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  findEventsByName
};
