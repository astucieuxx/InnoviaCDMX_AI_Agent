/**
 * Ubicacion Handler
 * 
 * Handles location inquiries.
 * Provides address, hours, and invites to schedule an appointment.
 */

const {
  getBusinessName,
  getBusinessAddress,
  getBusinessMapsLink,
  getBusinessHours,
  getCatalogLink,
  getCatalogName
} = require('../../config');
const { getClientName, getClientFirstName } = require('../utils/name-utils');

/**
 * Execute ubicacion intent handler
 * @param {Object} session - Session object
 * @param {string} message - User's message
 * @returns {Promise<Object>} { reply: string, sessionUpdates: object }
 */
async function execute(session, message) {
  const nombre = getBusinessName();
  const direccion = getBusinessAddress();
  const mapsLink = getBusinessMapsLink();
  const horarios = getBusinessHours();
  const catalogoLink = getCatalogLink();
  const catalogoNombre = getCatalogName();

  const nombreCliente = getClientName(session);
  const nombrePrimero = getClientFirstName(session);

  // Check if this is a button click (message will be the button ID like 'info_ubicacion')
  const isButtonClick = message === 'info_ubicacion' || message === 'UBICACION';
  
  // Build location message (no greeting)
  let reply = '';

  // Catalog section
  if (catalogoLink) {
    reply += `📖 *Nuestro catálogo ${catalogoNombre}:*\n${catalogoLink}\n\n`;
  }

  reply += `¡Claro! Estamos en 📍${direccion}, en un showroom pensado para que vivas tu elección con calma y estilo ✨\n\n`;
  
  // Add maps link if available
  if (mapsLink) {
    reply += `Aquí puedes ver cómo llegar: ${mapsLink}\n\n`;
  }
  
  // Add hours
  reply += `Estamos abiertos:\n`;
  reply += `• Martes a sábado: ${horarios.martes_sabado || 'N/A'}\n`;
  reply += `• Domingos: ${horarios.domingos || 'N/A'}\n`;
  reply += `• Lunes: ${horarios.lunes || 'Cerrado'}\n\n`;
  
  // Always invite to schedule
  reply += `¿Te gustaría agendar una cita? 💐\n\n`;
  
  // If we have nombre and fecha_boda, personalize more
  if (nombreCliente && session.fecha_boda) {
    reply += `Sería un honor recibirte y ayudarte a encontrar el vestido perfecto para tu boda ✨`;
  } else {
    // If we don't have full info, ask for it (only if not from button click)
    if (!isButtonClick) {
      if (!nombreCliente && !session.fecha_boda) {
        reply += `¿Me compartes tu nombre completo, fecha de boda y qué día/hora te gustaría visitarnos? Así te preparo mejor la experiencia 💫`;
      } else if (!nombreCliente) {
        reply += `¿Me compartes tu nombre completo y qué día/hora te gustaría visitarnos? Así te preparo mejor la experiencia 💫`;
      } else {
        reply += `¿Me compartes la fecha de tu boda y qué día/hora te gustaría visitarnos? Así te preparo mejor la experiencia 💫`;
      }
    }
  }

  const sessionUpdates = {};

  // Update etapa if we're moving from primer_contacto to interesada
  if (session.etapa === 'primer_contacto' && nombreCliente && session.fecha_boda) {
    sessionUpdates.etapa = 'interesada';
  }

  return {
    reply,
    sessionUpdates
  };
}

module.exports = { execute };
