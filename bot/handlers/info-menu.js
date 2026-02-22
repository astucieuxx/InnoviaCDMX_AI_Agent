/**
 * Info Menu Handler
 * 
 * Shows submenu with information options: catalog, prices, location
 */

const {
  getBusinessName,
  getBusinessAddress,
  getBusinessHours,
  getCatalogLink
} = require('../../config');
const { getClientFirstName } = require('../utils/name-utils');

/**
 * Execute info menu handler
 * @param {Object} session - Session object
 * @param {string} message - User's message
 * @returns {Promise<Object>} { reply: string, sessionUpdates: object, buttons: array }
 */
async function execute(session, message) {
  const nombre = getBusinessName();
  const direccion = getBusinessAddress();
  const horarios = getBusinessHours();
  const catalogoLink = getCatalogLink();

  const reply = `¿Qué información te gustaría conocer?`;

  const buttons = [
    {
      id: 'info_catalogo',
      title: 'Ver Catálogo'
    },
    {
      id: 'info_precios',
      title: 'Ver Precios'
    },
    {
      id: 'info_ubicacion',
      title: 'Ver Ubicación'
    }
  ];

  return {
    reply,
    sessionUpdates: {},
    buttons: buttons
  };
}

module.exports = { execute };
