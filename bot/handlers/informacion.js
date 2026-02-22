/**
 * Informacion Handler
 * 
 * Handles general information requests about the boutique.
 * Shares catalog link and invites to schedule an appointment.
 */

const {
  getBusinessName,
  getBusinessType,
  getAdvisorName,
  getBusinessAddress,
  getBusinessHours,
  getCatalogLink,
  getCatalogName
} = require('../../config');
const { getClientName, getClientFirstName } = require('../utils/name-utils');

/**
 * Execute informacion intent handler
 * @param {Object} session - Session object
 * @param {string} message - User's message
 * @returns {Promise<Object>} { reply: string, sessionUpdates: object }
 */
async function execute(session, message) {
  const nombre = getBusinessName();
  const tipo = getBusinessType();
  const asesora = getAdvisorName();
  const direccion = getBusinessAddress();
  const horarios = getBusinessHours();
  const catalogoLink = getCatalogLink();
  const catalogoNombre = getCatalogName();

  const nombrePrimero = getClientFirstName(session);
  
  // Personalize greeting if we have the client's name
  const saludo = nombrePrimero 
    ? `¡Hola ${nombrePrimero}! ✨`
    : `¡Hola! ✨`;

  // Build information message
  let reply = `${saludo} Qué emoción tenerte por aquí 💫\n\n`;
  
  reply += `Soy ${asesora} de ${nombre}, ${tipo} ubicada en 📍${direccion}.\n\n`;
  
  reply += `Estamos abiertos:\n`;
  reply += `• Martes a sábado: ${horarios.martes_sabado || 'N/A'}\n`;
  reply += `• Domingos: ${horarios.domingos || 'N/A'}\n`;
  reply += `• Lunes: ${horarios.lunes || 'Cerrado'}\n\n`;
  
  reply += `Aquí puedes ver nuestro catálogo ${catalogoNombre}:\n${catalogoLink}\n\n`;
  
  const nombreCliente = getClientName(session);
  
  // Always end with invitation to schedule
  if (nombreCliente && session.fecha_boda) {
    // If we have both, personalize more
    reply += `Sería un honor ayudarte a encontrar el vestido perfecto para tu boda ✨\n\n`;
    reply += `¿Te gustaría agendar una cita en nuestro showroom para probarte tus favoritos? 💐`;
  } else {
    // If we don't have full info yet, ask for it
    if (!nombreCliente && !session.fecha_boda) {
      reply += `Para ayudarte mejor, ¿me compartes tu nombre completo y la fecha de tu boda? Así te acompaño mejor desde el inicio 💐\n\n`;
      reply += `Y claro, ¡también podemos agendar una cita para que vivas la experiencia completa! ✨`;
    } else if (!nombreCliente) {
      reply += `¿Me compartes tu nombre completo? Y claro, ¡también podemos agendar una cita para que vivas la experiencia completa! ✨`;
    } else {
      reply += `¿Me compartes la fecha de tu boda? Y claro, ¡también podemos agendar una cita para que vivas la experiencia completa! ✨`;
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
