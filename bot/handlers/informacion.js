/**
 * Informacion Handler
 *
 * Handles general information requests about the boutique.
 * Responds immediately with catalog + location to avoid longer conversations.
 */

const {
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
  const direccion = getBusinessAddress();
  const horarios = getBusinessHours();
  const catalogoLink = getCatalogLink();
  const catalogoNombre = getCatalogName();

  const nombreCliente = getClientName(session);
  const nombrePrimero = getClientFirstName(session);

  // Greeting
  let reply = nombrePrimero
    ? `¡Hola ${nombrePrimero}! Con mucho gusto te cuento todo 🤍\n\n`
    : `¡Con mucho gusto te cuento todo! 🤍\n\n`;

  // Catalog section
  reply += `📖 *Nuestro catálogo ${catalogoNombre}:*\n${catalogoLink}\n\n`;
  reply += `Te confieso que en persona es otra historia 😍 Ver los vestidos en fotos es una cosa, pero probártelos es una experiencia completamente diferente ✨\n\n`;

  // Location section
  reply += `📍 *Estamos en:* ${direccion}\n\n`;

  // Hours
  reply += `🕐 *Horarios:*\n`;
  reply += `• Martes a sábado: ${horarios.martes_sabado || 'N/A'}\n`;
  reply += `• Domingos: ${horarios.domingos || 'N/A'}\n`;
  reply += `• Lunes: ${horarios.lunes || 'Cerrado'}\n\n`;

  // CTA
  if (nombreCliente && session.fecha_boda) {
    reply += `¿Te gustaría agendar una cita para vivir la experiencia en persona? Sería un honor acompañarte a encontrar el vestido perfecto 💐`;
  } else {
    reply += `¿Te gustaría agendar una cita para conocernos y probar los vestidos que más te gusten? 💐`;
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
