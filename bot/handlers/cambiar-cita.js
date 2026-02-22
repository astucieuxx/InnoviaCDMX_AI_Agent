/**
 * Cambiar Cita Handler
 * 
 * Handles appointment rescheduling requests.
 * Shows existing appointment info and initiates rescheduling flow.
 */

const {
  getBusinessName
} = require('../../config');

const { findEventsByName } = require('../calendar-service');
const { getClientName, getClientFirstName } = require('../utils/name-utils');

/**
 * Execute cambiar cita intent handler
 * @param {Object} session - Session object
 * @param {string} message - User's message
 * @param {Object} calendarDeps - Calendar dependencies { calendarClient, authClient, calendarId }
 * @returns {Promise<Object>} { reply: string, sessionUpdates: object, buttons?: array }
 */
async function execute(session, message, calendarDeps = null) {
  const nombre = getBusinessName();
  const nombrePrimero = getClientFirstName(session);

  let existingEvent = null;
  
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
          // Update session with the event ID
          console.log(`✅ Cita existente encontrada por nombre: ${existingEvent.summary}`);
        }
      }
    } catch (error) {
      console.error('❌ Error buscando cita existente:', error.message);
    }
  }

  let reply;
  const sessionUpdates = {};

  // Show existing appointment info if found
  if (existingEvent) {
    // Parse event start date - interpretar como hora de CDMX
    let eventStart;
    const eventStartStr = existingEvent.start.dateTime || existingEvent.start.date;
    
    if (typeof eventStartStr === 'string' && eventStartStr.includes('T')) {
      // Si viene como ISO string, parsearlo y tratarlo como hora local de CDMX
      const dateMatch = eventStartStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
      if (dateMatch) {
        const [, year, month, day, hour, minute, second] = dateMatch.map(Number);
        // Crear fecha interpretada como hora local de CDMX (no UTC)
        eventStart = new Date(year, month - 1, day, hour, minute, second || 0);
      } else {
        eventStart = new Date(eventStartStr);
      }
    } else {
      eventStart = new Date(eventStartStr);
    }
    
    // Formatear fecha y hora SIEMPRE en zona horaria de CDMX
    const formattedDate = eventStart.toLocaleDateString('es-MX', { 
      timeZone: 'America/Mexico_City',
      weekday: 'long',
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    const formattedTime = eventStart.toLocaleTimeString('es-MX', { 
      timeZone: 'America/Mexico_City',
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: true 
    });
    
    // Capitalize first letter of weekday
    const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    
    reply = `¡Por supuesto ${nombrePrimero}! 💐\n\n`;
    reply += `Tu cita actual está agendada para:\n\n`;
    reply += `📅 Fecha: ${capitalizedDate}\n`;
    reply += `🕐 Hora: ${formattedTime}\n\n`;
    reply += `¿Qué te gustaría hacer con tu cita?`;
    
    // Offer buttons: Move to new date or Cancel
    const buttons = [
      { id: 'cita_mover', title: 'Mover a Nueva Fecha' },
      { id: 'cita_cancelar', title: 'Cancelar Cita' }
    ];
    
    // Keep calendar_event_id for updating/deleting
    sessionUpdates.calendar_event_id = existingEvent.id;
    
    return {
      reply,
      sessionUpdates,
      buttons
    };
  } else {
    // No existing appointment found
    reply = `¡Hola ${nombrePrimero}! ✨\n\n`;
    reply += `No encontré una cita agendada para cambiar. ¿Te gustaría agendar una nueva cita?`;
    
    sessionUpdates.etapa = 'interesada';
    sessionUpdates.slots_disponibles = null;
    sessionUpdates.fecha_cita_solicitada = null;
    sessionUpdates.fecha_cita = null;
    
    return {
      reply,
      sessionUpdates
    };
  }
}

module.exports = { execute };
