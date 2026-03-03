/**
 * Informacion Handler
 * 
 * Handles general information requests about the boutique.
 * Shows information submenu with options: catalog, prices, location
 */

const { getClientName } = require('../utils/name-utils');

/**
 * Execute informacion intent handler
 * @param {Object} session - Session object
 * @param {string} message - User's message
 * @returns {Promise<Object>} { reply: string, sessionUpdates: object, buttons: array }
 */
async function execute(session, message) {
  // Delegate to info-menu handler to show submenu
  const infoMenuHandler = require('./info-menu');
  const result = await infoMenuHandler.execute(session, message);
  
  const sessionUpdates = {};
  const nombreCliente = getClientName(session);
  
  // Update etapa if we're moving from primer_contacto to interesada
  if (session.etapa === 'primer_contacto' && nombreCliente && session.fecha_boda) {
    sessionUpdates.etapa = 'interesada';
  }
  
  return {
    reply: result.reply,
    sessionUpdates: { ...result.sessionUpdates, ...sessionUpdates },
    buttons: result.buttons
  };
}

module.exports = { execute };
