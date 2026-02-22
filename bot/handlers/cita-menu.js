/**
 * Cita Menu Handler
 * 
 * Shows submenu for appointment actions: new appointment, edit, or cancel
 */

const { getClientFirstName } = require('../utils/name-utils');

/**
 * Execute cita menu handler
 * @param {Object} session - Session object
 * @param {string} message - User's message
 * @returns {Promise<Object>} { reply: string, sessionUpdates: object, buttons: array }
 */
async function execute(session, message) {
  const nombrePrimero = getClientFirstName(session);
  const tieneCita = session.etapa === 'cita_agendada' && session.calendar_event_id;

  let reply;
  if (tieneCita) {
    reply = `Muy bien ${nombrePrimero}! ✨ Veo que ya tienes una cita agendada. ¿Qué te gustaría hacer?`;
  } else {
    reply = `¡Muy bien! ✨ ¿Qué te gustaría hacer?`;
  }

  const buttons = [
    {
      id: 'cita_nueva',
      title: 'Agendar Nueva Cita' // 20 caracteres (máximo)
    },
    {
      id: 'cita_editar',
      title: 'Editar Cita' // 12 caracteres
    },
    {
      id: 'cita_cancelar',
      title: 'Cancelar Cita' // 15 caracteres
    }
  ];

  return {
    reply,
    sessionUpdates: {},
    buttons: buttons
  };
}

module.exports = { execute };
