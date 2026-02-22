/**
 * Catalogo Handler
 * 
 * Handles catalog requests.
 * Shares catalog link and invites to schedule an appointment to try on dresses.
 */

const {
  getBusinessName,
  getCatalogLink,
  getCatalogName,
  getBusinessHours
} = require('../../config');
const { getClientName, getClientFirstName } = require('../utils/name-utils');

/**
 * Execute catalogo intent handler
 * @param {Object} session - Session object
 * @param {string} message - User's message
 * @returns {Promise<Object>} { reply: string, sessionUpdates: object }
 */
async function execute(session, message) {
  const nombre = getBusinessName();
  const catalogoLink = getCatalogLink();
  const catalogoNombre = getCatalogName();
  const horarios = getBusinessHours();

  const nombreCliente = getClientName(session);
  const nombrePrimero = getClientFirstName(session);

  // Check if this is a button click (message will be the button ID like 'info_catalogo')
  const isButtonClick = message === 'info_catalogo' || message === 'CATALOGO';
  
  // Build catalog message (no greeting if it's a button click - user is already in conversation)
  let reply = '';
  
  if (!isButtonClick && nombrePrimero) {
    // Only greet if it's a text message and we have the name
    reply = `¡Hola ${nombrePrimero}! ✨ Con gusto! 🤍\n\n`;
  } else if (!isButtonClick) {
    // Only greet if it's a text message
    reply = `¡Hola! ✨ Con gusto! 🤍\n\n`;
  } else {
    // Button click - just say "Con gusto"
    reply = `Con gusto! 🤍\n\n`;
  }
  
  reply += `Aquí te dejo nuestro catálogo ${catalogoNombre}:\n${catalogoLink}\n\n`;
  
  // Emphasize that in-person experience is different
  reply += `Pero te confieso algo... en persona es otra historia 😍\n\n`;
  reply += `Ver los vestidos en fotos es una cosa, pero probártelos y sentir cómo te quedan es una experiencia completamente diferente ✨\n\n`;
  
  // Always invite to schedule
  reply += `¿Te gustaría agendar una cita para probar los que más te gusten? 💐\n\n`;
  
  // Add hours information
  reply += `Estamos abiertos:\n`;
  reply += `• Martes a sábado: ${horarios.martes_sabado || 'N/A'}\n`;
  reply += `• Domingos: ${horarios.domingos || 'N/A'}\n`;
  reply += `• Lunes: ${horarios.lunes || 'Cerrado'}\n\n`;
  
  // If we have nombre and fecha_boda, personalize more
  if (nombreCliente && session.fecha_boda) {
    reply += `Sería un honor ayudarte a encontrar el vestido perfecto para tu boda ✨`;
  } else {
    // If we don't have full info, gently ask (only if not from button click)
    if (!isButtonClick) {
      if (!nombreCliente && !session.fecha_boda) {
        reply += `Por cierto, ¿me compartes tu nombre completo y la fecha de tu boda? Así te preparo mejor la experiencia 💫`;
      } else if (!nombreCliente) {
        reply += `Por cierto, ¿me compartes tu nombre completo? Así te preparo mejor la experiencia 💫`;
      } else {
        reply += `Por cierto, ¿me compartes la fecha de tu boda? Así te preparo mejor la experiencia 💫`;
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
