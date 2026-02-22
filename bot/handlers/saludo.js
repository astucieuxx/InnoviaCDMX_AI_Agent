/**
 * Saludo Handler
 * 
 * Handles greeting and initial contact.
 * Asks for nombre and fecha_boda if not yet provided.
 */

const {
  getBusinessName,
  getAdvisorName,
  getBusinessAddress,
  getCatalogLink,
  getResponseTemplate,
  getBotMessage
} = require('../../config');
const { analyzeContextualResponse } = require('../utils/context-analyzer');
const { getClientName, getClientFirstName } = require('../utils/name-utils');

/**
 * Execute saludo intent handler
 * @param {Object} session - Session object
 * @param {string} message - User's message
 * @returns {Promise<Object>} { reply: string, sessionUpdates: object }
 */
async function execute(session, message) {
  const nombre = getBusinessName();
  const asesora = getAdvisorName();
  const direccion = getBusinessAddress();
  const catalogoLink = getCatalogLink();

  // Check if we already have nombre_cliente/nombre_novia and fecha_boda
  // IMPORTANT: Always check the session AFTER profile extraction has updated it
  const nombreCliente = getClientName(session);
  const nombrePrimero = getClientFirstName(session);
  const hasNombre = nombreCliente && nombreCliente.trim().length > 0;
  const hasFechaBoda = session.fecha_boda && session.fecha_boda.trim().length > 0;
  const fechaBodaDeclinada = session.fecha_boda_declinada === true; // User indicated they don't have wedding date

  let reply;
  const sessionUpdates = {};
  const buttons = [];

  // Use LLM to analyze user response when asked for wedding date
  let dateResponseAnalysis = null;
  if (!hasFechaBoda && !fechaBodaDeclinada && hasNombre) {
    // Check if bot just asked for fecha_boda
    const lastAssistantMessage = session.historial && session.historial.length > 0
      ? session.historial.filter(m => m.role === 'assistant').slice(-1)[0]?.content || ''
      : '';
    const botJustAskedForDate = lastAssistantMessage.includes('fecha') && 
                                (lastAssistantMessage.includes('boda') || lastAssistantMessage.includes('completa'));
    
    if (botJustAskedForDate) {
      // Use LLM to understand user's response
      const lastBotMessage = lastAssistantMessage;
      dateResponseAnalysis = await analyzeContextualResponse(
        message,
        'wedding_date_collection',
        session,
        { lastBotMessage }
      );
      console.log(`📊 Análisis de respuesta de fecha:`, dateResponseAnalysis);
    }
  }

  // NEW FLOW: If user just provided their name, ask for fecha_boda to complete info collection
  // Only show menu when we have both name and fecha_boda (or declined)
  
  // Check if user just provided their name (we have name but no fecha_boda and not declined)
  if (hasNombre && !hasFechaBoda && !fechaBodaDeclinada) {
    // User has name but no fecha_boda - ask for it
    const nombreCliente = nombrePrimero || getClientName(session);
    
    // Check if this is a response to a wedding date question
    if (dateResponseAnalysis) {
      if (dateResponseAnalysis.action === 'decline_date') {
        // User declined to provide date
        sessionUpdates.fecha_boda_declinada = true;
        // Show menu since info collection is complete
        reply = getBotMessage('saludo', 'con_nombre_sin_fecha', {
          nombre_cliente: nombreCliente
        }) || `¡Hola ${nombreCliente}! ✨ Bienvenida a ${nombre} 💫\n\n¿En qué puedo ayudarte hoy?`;
        buttons.push({
          id: 'menu_agendar',
          title: 'Agendar/Editar Cita'
        });
        buttons.push({
          id: 'menu_info',
          title: 'Obtener Info'
        });
        buttons.push({
          id: 'menu_asesor',
          title: 'Contactar Asesor'
        });
      } else if (dateResponseAnalysis.action === 'provide_date') {
        // User provided date - it should be extracted by profile extractor
        // For now, just acknowledge and show menu
        reply = getBotMessage('saludo', 'con_nombre_sin_fecha', {
          nombre_cliente: nombreCliente
        }) || `¡Hola ${nombreCliente}! ✨ Bienvenida a ${nombre} 💫\n\n¿En qué puedo ayudarte hoy?`;
        buttons.push({
          id: 'menu_agendar',
          title: 'Agendar/Editar Cita'
        });
        buttons.push({
          id: 'menu_info',
          title: 'Obtener Info'
        });
        buttons.push({
          id: 'menu_asesor',
          title: 'Contactar Asesor'
        });
      } else {
        // Unclear response - ask again
        reply = getBotMessage('saludo', 'pidiendo_fecha_boda', {
          nombre_cliente: nombreCliente
        }) || `¡Perfecto ${nombreCliente}! ✨ Para ayudarte mejor, ¿me compartes la fecha completa de tu boda? Por favor incluye el día, mes y año (por ejemplo: "10 de julio 2026"). Si aún no la tienes definida, no hay problema, solo dímelo 💫`;
      }
    } else {
      // First time asking for fecha_boda
      reply = getBotMessage('saludo', 'pidiendo_fecha_boda', {
        nombre_cliente: nombreCliente
      }) || `¡Perfecto ${nombreCliente}! ✨ Para ayudarte mejor, ¿me compartes la fecha completa de tu boda? Por favor incluye el día, mes y año (por ejemplo: "10 de julio 2026"). Si aún no la tienes definida, no hay problema, solo dímelo 💫`;
      sessionUpdates.pending_fecha_boda = true;
    }
  } else if (hasNombre && (hasFechaBoda || fechaBodaDeclinada)) {
    // User has both name and fecha_boda (or declined) - show appointment submenu directly
    const nombreCliente = nombrePrimero || getClientName(session);
    const tieneCita = session.etapa === 'cita_agendada' && session.calendar_event_id;
    
    if (hasFechaBoda) {
      reply = getBotMessage('saludo', 'con_nombre_y_fecha', {
        nombre_cliente: nombreCliente,
        fecha_boda: formatFechaBoda(session.fecha_boda)
      }) || `¡Muy bien ${nombreCliente}! ✨ Qué emoción, tu boda el ${formatFechaBoda(session.fecha_boda)} está a la vuelta de la esquina 💫\n\n¿Qué te gustaría hacer?`;
    } else {
      reply = getBotMessage('saludo', 'con_nombre_sin_fecha', {
        nombre_cliente: nombreCliente
      }) || `¡Hola ${nombreCliente}! ✨ Bienvenida a ${nombre} 💫\n\n¿Qué te gustaría hacer?`;
    }
    
    // Show appointment submenu buttons directly (not main menu)
    buttons.push({
      id: 'cita_nueva',
      title: 'Agendar Nueva Cita'
    });
    buttons.push({
      id: 'cita_editar',
      title: 'Editar Cita'
    });
    buttons.push({
      id: 'cita_cancelar',
      title: 'Cancelar Cita'
    });
  } else {
    // First contact - just greet and show options
    reply = getBotMessage('saludo', 'primer_contacto', {
      business_name: nombre,
      business_address: direccion,
      catalog_link: catalogoLink
    }) || `¡Hola! 👰‍♀️ Qué emoción tenerte por aquí 💫 Bienvenida a ${nombre}.\n\nEstamos en 📍${direccion} y sería un honor ayudarte a encontrar el vestido que diga "¡soy yo!" ✨\n\nPuedes ver nuestro catálogo aquí: ${catalogoLink}\n\n¿En qué puedo ayudarte hoy?`;
    
    // Show menu buttons
    buttons.push({
      id: 'menu_agendar',
      title: 'Agendar/Editar Cita'
    });
    buttons.push({
      id: 'menu_info',
      title: 'Obtener Info'
    });
    buttons.push({
      id: 'menu_asesor',
      title: 'Contactar Asesor'
    });
  }
  
  // Update etapa to interesada (user has engaged)
  if (session.etapa === 'primer_contacto' || !session.etapa) {
    sessionUpdates.etapa = 'interesada';
  }

  return {
    reply,
    sessionUpdates,
    buttons: buttons.length > 0 ? buttons : undefined
  };
}

/**
 * Format fecha_boda for display (DD/MM/YYYY)
 * @param {string} fecha - Date in YYYY-MM-DD format
 * @returns {string} Formatted date
 */
function formatFechaBoda(fecha) {
  if (!fecha) return fecha;
  
  try {
    // If already in YYYY-MM-DD format
    if (fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = fecha.split('-');
      return `${day}/${month}/${year}`;
    }
    
    // Try to parse and format
    const dateObj = new Date(fecha);
    if (!isNaN(dateObj.getTime())) {
      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    // Return original if parsing fails
  }
  
  return fecha;
}

module.exports = { execute };
