/**
 * Precios Handler
 * 
 * Handles pricing inquiries.
 * Mentions base price, explains it varies, and invites to schedule for special offers.
 */

const {
  getBusinessName,
  getBasePrice,
  getPricingInfo
} = require('../../config');
const { getClientName, getClientFirstName } = require('../utils/name-utils');

/**
 * Execute precios intent handler
 * @param {Object} session - Session object
 * @param {string} message - User's message
 * @returns {Promise<Object>} { reply: string, sessionUpdates: object }
 */
async function execute(session, message) {
  const nombre = getBusinessName();
  const precioBase = getBasePrice();
  const pricingInfo = getPricingInfo();
  const moneda = pricingInfo.moneda || 'MXN';
  const nota = pricingInfo.nota || 'El precio varía según modelo, forma de pago, fecha de compra, promociones y personalizaciones.';

  const nombreCliente = getClientName(session);
  const nombrePrimero = getClientFirstName(session);

  // Check if this is a button click (message will be the button ID like 'info_precios')
  const isButtonClick = message === 'info_precios' || message === 'PRECIOS';
  
  // Build pricing message (no greeting if it's a button click - user is already in conversation)
  let reply = '';
  
  if (!isButtonClick && nombrePrimero) {
    // Only greet if it's a text message and we have the name
    reply = `¡Hola ${nombrePrimero}! ✨\n\n`;
  } else if (!isButtonClick) {
    // Only greet if it's a text message
    reply = `¡Hola! ✨\n\n`;
  }
  
  reply += `Nuestros vestidos inician en $${precioBase.toLocaleString('es-MX')} ${moneda}.\n\n`;
  
  // Explain that price varies
  reply += `${nota}\n\n`;
  
  // Emphasize that best pricing is in showroom
  reply += `Lo mejor es verlo contigo en showroom, porque nuestras asesoras pueden conseguirte sorpresas especiales ✨\n\n`;
  
  // Always invite to schedule
  reply += `¿Te gustaría agendar una cita? ✨\n\n`;
  
  // If we have nombre and fecha_boda, personalize more
  if (nombreCliente && session.fecha_boda) {
    reply += `Sería un honor ayudarte a encontrar el vestido perfecto para tu boda y ver qué opciones tenemos disponibles para ti 💐`;
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
