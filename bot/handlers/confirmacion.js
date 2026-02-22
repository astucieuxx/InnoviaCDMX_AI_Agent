/**
 * Confirmacion Handler
 * 
 * Handles appointment confirmation, cancellation, or rescheduling requests.
 * Only triggered when etapa === 'cita_agendada' and user confirms/cancels/reschedules.
 */

const {
  getBusinessName,
  getBusinessAddress,
  getCatalogLink
} = require('../../config');

/**
 * Execute confirmacion intent handler
 * @param {Object} session - Session object
 * @param {string} message - User's message
 * @param {Object} calendarDeps - Optional calendar dependencies { calendarClient, authClient, calendarId }
 * @returns {Promise<Object>} { reply: string, sessionUpdates: object, buttons?: array }
 */
async function execute(session, message, calendarDeps = null) {
  const nombre = getBusinessName();
  const direccion = getBusinessAddress();
  const catalogoLink = getCatalogLink();

  const messageLower = message.toLowerCase();
  const nombreNovia = session.nombre_novia || 'querida';

  // This handler only handles confirmations (not cancellations or rescheduling)
  // Those are handled by CANCELAR_CITA and CAMBIAR_CITA handlers

  let reply;
  const sessionUpdates = {};

  // User confirms appointment
  const confirma = messageLower.includes('confirmo') || 
                   messageLower.includes('sí voy') || 
                   messageLower.includes('si voy') ||
                   messageLower.includes('voy a ir') ||
                   messageLower.includes('asistiré') ||
                   messageLower.includes('estaré');

  if (confirma) {
    // User confirms appointment
    reply = `¡Perfecto ${nombreNovia}! 👰‍♀️✨\n\n`;
    reply += `Estamos emocionados de recibirte. Te esperamos en nuestro showroom: 📍${direccion}\n\n`;
    
    // If we have fecha_cita_solicitada, mention it
    if (session.fecha_cita_solicitada) {
      const fechaCita = formatDate(session.fecha_cita_solicitada);
      reply += `Tu cita está confirmada para el ${fechaCita} 💐\n\n`;
    }
    
    reply += `¡Te mandamos el catálogo para que elijas tus 5 favoritos antes de llegar! 💖\n${catalogoLink}\n\n`;
    reply += `Cualquier duda, aquí estamos. ¡Nos vemos pronto! ✨`;
    
    // Keep etapa as 'cita_agendada' (already confirmed)
    
  } else {
    // Ambiguous message - ask for clarification
    reply = `¡Hola ${nombreNovia}! 👰‍♀️\n\n`;
    reply += `¿Quieres confirmar tu cita, cancelarla o reagendarla para otro día?\n\n`;
    reply += `Solo dime qué prefieres y te ayudo con gusto 💫`;
  }

  return {
    reply,
    sessionUpdates
  };
}

/**
 * Format date for display (DD/MM/YYYY)
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {string} Formatted date
 */
function formatDate(date) {
  if (!date) return date;
  
  try {
    if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = date.split('-');
      return `${day}/${month}/${year}`;
    }
    
    const dateObj = new Date(date);
    if (!isNaN(dateObj.getTime())) {
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    // Return original if parsing fails
  }
  
  return date;
}

module.exports = { execute };
