/**
 * Cancelar Cita Handler
 * 
 * Handles appointment cancellation requests.
 * Searches for existing appointment and cancels it.
 */

const {
  getBusinessName,
  getBusinessAddress
} = require('../../config');

const { findEventsByName } = require('../calendar-service');
const { getClientName, getClientFirstName } = require('../utils/name-utils');

/**
 * Format date for display in Spanish (e.g., "lunes, 5 de marzo 2026")
 * @param {Date|string} dateInput - Date object or ISO string
 * @returns {string} Formatted date string
 */
function formatDateSpanish(dateInput) {
  try {
    let date;
    
    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      // Si viene como ISO string, parsearlo y tratarlo como hora local de CDMX
      if (dateInput.includes('T')) {
        const dateMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
        if (dateMatch) {
          const [, year, month, day, hour, minute, second] = dateMatch.map(Number);
          // Crear fecha interpretada como hora local de CDMX (no UTC)
          date = new Date(year, month - 1, day, hour, minute, second || 0);
        } else {
          date = new Date(dateInput);
        }
      } else {
        // Try parsing as ISO string first
        date = new Date(dateInput);
        
        // If that fails, try parsing as YYYY-MM-DD
        if (isNaN(date.getTime()) && dateInput.match(/^\d{4}-\d{2}-\d{2}/)) {
          const [year, month, day] = dateInput.split('-').map(Number);
          date = new Date(year, month - 1, day);
        }
        
        // If still fails, try DD/MM/YYYY
        if (isNaN(date.getTime()) && dateInput.match(/^\d{1,2}\/\d{1,2}\/\d{4}/)) {
          const [day, month, year] = dateInput.split('/').map(Number);
          date = new Date(year, month - 1, day);
        }
      }
    } else {
      console.error('Invalid date input type:', typeof dateInput);
      throw new Error('Invalid date input');
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date after parsing:', dateInput);
      throw new Error('Invalid date');
    }
    
    // Obtener componentes de fecha en zona horaria de CDMX
    // Usar toLocaleString con timeZone para obtener los valores correctos
    const dateInCDMX = new Date(date.toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
    
    const dayOfWeekNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                        'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    
    // Obtener día de la semana usando la fecha en CDMX
    const dayOfWeek = dayOfWeekNames[dateInCDMX.getDay()];
    const day = dateInCDMX.getDate();
    const month = monthNames[dateInCDMX.getMonth()];
    const year = dateInCDMX.getFullYear();
    
    // Capitalize first letter
    const capitalizedDayOfWeek = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
    
    return `${capitalizedDayOfWeek}, ${day} de ${month} ${year}`;
  } catch (error) {
    console.error('Error formateando fecha:', error, 'Input:', dateInput);
    // Last resort: try to extract date parts from string if possible
    if (typeof dateInput === 'string') {
      const dateMatch = dateInput.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return `${day} de ${monthNames[parseInt(month) - 1]} ${year}`;
      }
    }
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Format time for display (e.g., "11:00 AM")
 * @param {Date|string} dateInput - Date object or ISO string
 * @returns {string} Formatted time string
 */
function formatTimeSpanish(dateInput) {
  try {
    let date;
    
    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      // Si viene como ISO string, parsearlo y tratarlo como hora local de CDMX
      if (dateInput.includes('T')) {
        const dateMatch = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
        if (dateMatch) {
          const [, year, month, day, hour, minute, second] = dateMatch.map(Number);
          // Crear fecha interpretada como hora local de CDMX (no UTC)
          date = new Date(year, month - 1, day, hour, minute, second || 0);
        } else {
          date = new Date(dateInput);
        }
      } else {
        // Try parsing as ISO string first
        date = new Date(dateInput);
        
        // If that fails, try extracting time from ISO string
        if (isNaN(date.getTime())) {
          const timeMatch = dateInput.match(/T(\d{2}):(\d{2})/);
          if (timeMatch) {
            const [, hour, minute] = timeMatch;
            const hourNum = parseInt(hour);
            const ampm = hourNum >= 12 ? 'PM' : 'AM';
            const displayHour = hourNum > 12 ? hourNum - 12 : (hourNum === 0 ? 12 : hourNum);
            return `${String(displayHour).padStart(2, '0')}:${minute} ${ampm}`;
          }
        }
      }
    } else {
      console.error('Invalid time input type:', typeof dateInput);
      throw new Error('Invalid time input');
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.error('Invalid date for time formatting:', dateInput);
      throw new Error('Invalid date');
    }
    
    return date.toLocaleTimeString('es-MX', { 
      timeZone: 'America/Mexico_City',
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });
  } catch (error) {
    console.error('Error formateando hora:', error, 'Input:', dateInput);
    throw error; // Re-throw to let caller handle
  }
}

/**
 * Execute cancelar cita intent handler
 * @param {Object} session - Session object
 * @param {string} message - User's message
 * @param {Object} calendarDeps - Calendar dependencies { calendarClient, authClient, calendarId }
 * @returns {Promise<Object>} { reply: string, sessionUpdates: object }
 */
async function execute(session, message, calendarDeps = null) {
  const nombre = getBusinessName();
  const direccion = getBusinessAddress();
  const nombrePrimero = getClientFirstName(session);

  let existingEvent = null;
  let eventIdToCancel = null;

  // Try to find existing appointment
  if (calendarDeps && calendarDeps.calendarClient && calendarDeps.authClient) {
    try {
      // First, try to get event by ID if we have it
      if (session.calendar_event_id) {
        try {
          const auth = calendarDeps.authClient && typeof calendarDeps.authClient.getClient === 'function' 
            ? await calendarDeps.authClient.getClient() 
            : calendarDeps.authClient;
          
          const eventResponse = await calendarDeps.calendarClient.events.get({
            auth: auth,
            calendarId: calendarDeps.calendarId || 'primary',
            eventId: session.calendar_event_id
          });
          existingEvent = eventResponse.data;
          eventIdToCancel = existingEvent.id;
          console.log(`✅ Cita existente encontrada por ID: ${existingEvent.summary}`);
        } catch (error) {
          console.warn(`⚠️  Error al recuperar cita por ID (${session.calendar_event_id}): ${error.message}`);
          // Fallback: search by name
          existingEvent = null;
        }
      }
      
      // If no event found by ID, try searching by name
      const nombreCliente = getClientName(session);
      if (!existingEvent && nombreCliente) {
        const foundEvents = await findEventsByName(
          nombreCliente,
          calendarDeps.calendarClient,
          calendarDeps.authClient,
          calendarDeps.calendarId || 'primary',
          1 // Only need the first one
        );
        
        if (foundEvents.length > 0) {
          existingEvent = foundEvents[0];
          eventIdToCancel = existingEvent.id;
          console.log(`✅ Cita existente encontrada por nombre: ${existingEvent.summary}`);
        }
      }
    } catch (error) {
      console.error('❌ Error buscando cita existente:', error.message);
    }
  }

  let reply;
  const sessionUpdates = {};

  if (existingEvent && eventIdToCancel) {
    // Found appointment - show appointment details and ask for confirmation
    // Try to get formatted date/time from event (if it came from findEventsByName)
    let formattedDate, formattedTime;
    
    try {
      if (existingEvent.formattedDate && existingEvent.formattedTime) {
        // Event already has formatted date/time (from findEventsByName)
        // Convert DD/MM/YYYY to Spanish format
        try {
          const [day, month, year] = existingEvent.formattedDate.split('/');
          const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
          formattedDate = formatDateSpanish(dateObj);
          formattedTime = existingEvent.formattedTime; // Already formatted
        } catch (e) {
          // If conversion fails, format from event start
          const eventStart = existingEvent.start.dateTime || existingEvent.start.date || existingEvent.start;
          formattedDate = formatDateSpanish(eventStart);
          formattedTime = formatTimeSpanish(eventStart);
        }
      } else {
        // Parse from event start (when event comes directly from events.get)
        const eventStart = existingEvent.start.dateTime || existingEvent.start.date || existingEvent.start;
        formattedDate = formatDateSpanish(eventStart);
        formattedTime = formatTimeSpanish(eventStart);
      }
      
      // Show appointment details and ask for confirmation
      reply = `✅ Encontré tu cita agendada:\n\n`;
      reply += `📅 Fecha: ${formattedDate}\n`;
      reply += `🕐 Hora: ${formattedTime}\n\n`;
      reply += `¿Confirmas que deseas cancelar esta cita?`;
      
      // Store event ID for confirmation step
      sessionUpdates.pending_cancel_confirmation = true;
      sessionUpdates.calendar_event_id = eventIdToCancel;
      
      // Return with confirmation button
      return {
        reply,
        sessionUpdates,
        buttons: [
          {
            id: 'confirmar_cancelacion',
            title: 'Sí, Cancelar' // 13 caracteres (dentro del límite de 20)
          }
        ]
      };
    } catch (error) {
      // If all formatting fails, log error but still show a message with event info
      console.error('❌ Error formateando fecha/hora de cita:', error);
      console.error('   Event data:', JSON.stringify(existingEvent.start, null, 2));
      
      // Try one more time with raw event start
      try {
        const rawStart = existingEvent.start.dateTime || existingEvent.start.date;
        if (rawStart) {
          const dateObj = new Date(rawStart);
          if (!isNaN(dateObj.getTime())) {
            formattedDate = formatDateSpanish(dateObj);
            formattedTime = formatTimeSpanish(dateObj);
            reply = `✅ Encontré tu cita agendada:\n\n`;
            reply += `📅 Fecha: ${formattedDate}\n`;
            reply += `🕐 Hora: ${formattedTime}\n\n`;
            reply += `¿Confirmas que deseas cancelar esta cita?`;
            
            sessionUpdates.pending_cancel_confirmation = true;
            sessionUpdates.calendar_event_id = eventIdToCancel;
            
            return {
              reply,
              sessionUpdates,
              buttons: [
                {
                  id: 'confirmar_cancelacion',
                  title: 'Confirmar Cancelación'
                }
              ]
            };
          } else {
            throw new Error('Could not parse date');
          }
        } else {
          throw new Error('No start date in event');
        }
      } catch (finalError) {
        // Last resort: generic message with confirmation
        console.error('❌ Error final formateando fecha:', finalError);
        reply = `✅ Encontré una cita agendada a tu nombre.\n\n`;
        reply += `¿Confirmas que deseas cancelar esta cita?`;
        
        sessionUpdates.pending_cancel_confirmation = true;
        sessionUpdates.calendar_event_id = eventIdToCancel;
        
        return {
          reply,
          sessionUpdates,
          buttons: [
            {
              id: 'confirmar_cancelacion',
              title: 'Confirmar Cancelación'
            }
          ]
        };
      }
    }
  } else {
    // No appointment found
    reply = `¡Hola ${nombrePrimero}! ✨\n\n`;
    reply += `No encontré una cita agendada para cancelar. ¿Te gustaría agendar una nueva cita?`;
    
    sessionUpdates.etapa = 'interesada';
  }

  return {
    reply,
    sessionUpdates
  };
}

module.exports = { execute, formatDateSpanish, formatTimeSpanish };
