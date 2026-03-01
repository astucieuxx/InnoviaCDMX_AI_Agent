/**
 * Rule-based Intent Classifier
 * 
 * Fast, rule-based classification for common cases.
 * Falls back to LLM only when rules don't match.
 */

/**
 * Classify intent using simple rules (no LLM)
 * Only handles very obvious cases. Everything else goes to LLM for better understanding.
 * @param {string} message - User's message
 * @param {Object} session - Session object
 * @returns {string|null} Intent if matched by rules, null otherwise (null = use LLM)
 */
function classifyIntentWithRules(message, session) {
  const msg = message.toLowerCase().trim();
  
  // ONLY handle very obvious cases. For everything else, return null to use LLM.
  // This ensures the LLM can use full conversation context to make better decisions.
  
  // PRIORITY 1 (HIGHEST): If user explicitly wants to cancel/reschedule, handle it immediately
  // This must be checked FIRST, even before info collection, to ensure reschedule/cancel requests
  // are not incorrectly classified as AGENDAR_NUEVA
  // NOTE: 'no puedo', 'no podré', 'no voy' are intentionally excluded — they are too ambiguous
  // and can be false positives (e.g. "no puedo el martes, ¿tienen el miércoles?").
  // The LLM handles these cases correctly with full conversation context.
  const cancelKeywords = ['cancelar', 'cancel', 'no asistiré', 'no asistire', 'cancelar mi cita', 'cancelar cita'];
  const rescheduleKeywords = ['reagendar', 'cambiar', 'otra fecha', 'otro día', 'otro dia', 'mover', 'mover cita', 'cambiar fecha', 'cambiar mi cita', 'quiero cambiar'];
  
  if (cancelKeywords.some(kw => msg.includes(kw))) {
    return 'CANCELAR_CITA';
  }
  if (rescheduleKeywords.some(kw => msg.includes(kw))) {
    return 'CAMBIAR_CITA';
  }
  
  // PRIORITY 2: If user is providing info during scheduling flow, let LLM handle it
  // The LLM can better understand context, corrections, clarifications, etc.
  // We only force AGENDAR_NUEVA for pending_agendar_fecha (when user is providing appointment date)
  // For pending_nombre and pending_fecha_boda, let LLM analyze to understand the user's intent
  // This allows the LLM to handle corrections like "El día que te estoy diciendo no es lunes!!!!"
  
  // NOTE: We no longer force SALUDO for info collection
  // Users can access other features (info, catalog, etc.) without providing info first
  // Info will only be collected when they want to schedule an appointment
  
  // Check if there's an existing appointment
  const hasAppointment = session.etapa === 'cita_agendada' || session.calendar_event_id;
  
  // AGENDAR_NUEVA: If user is in the process of scheduling (pending_agendar_fecha flag)
  // This should be checked AFTER cancel/reschedule keywords to avoid conflicts
  // CRITICAL: ALWAYS force AGENDAR_NUEVA when pending_agendar_fecha is active
  // This ensures the date message reaches agendar.js handler, which can handle
  // both simple dates ("4 de marzo") and complex messages (corrections, clarifications)
  if (session.pending_agendar_fecha) {
    console.log(`📌 pending_agendar_fecha activo - FORZANDO AGENDAR_NUEVA para que el mensaje llegue a agendar.js`);
    return 'AGENDAR_NUEVA';
  }
  
  // AGENDAR_NUEVA: User wants to see afternoon slots or medio día slots (very specific context)
  if (!hasAppointment) {
    if (session.slots_tarde && session.slots_tarde.length > 0) {
      const afternoonKeywords = ['sí', 'si', 'tarde', 'afternoon', 'quiero ver', 'muéstrame', 'muestrame', 'opciones de tarde', 'por la tarde'];
      if (afternoonKeywords.some(kw => msg.includes(kw))) {
        return 'AGENDAR_NUEVA';
      }
    }
    if (session.slots_medio_dia && session.slots_medio_dia.length > 0) {
      const medioDiaKeywords = ['sí', 'si', 'medio día', 'medio dia', 'mañana', 'quiero ver', 'muéstrame', 'muestrame', 'opciones de medio día'];
      if (medioDiaKeywords.some(kw => msg.includes(kw))) {
        return 'AGENDAR_NUEVA';
      }
    }
  }
  
  // SALUDO: Only very obvious greetings (exact matches or with punctuation)
  const greetingKeywords = ['hola', 'hi', 'hello', 'buenos días', 'buenos dias', 'buenas tardes', 'buenas noches', 'buen día', 'buen dia'];
  // Check for exact match, starts with keyword + space, or keyword followed by punctuation
  if (greetingKeywords.some(kw => {
    return msg === kw || 
           msg.startsWith(kw + ' ') || 
           msg.startsWith(kw + '!') ||
           msg.startsWith(kw + '?') ||
           msg.startsWith(kw + '.');
  })) {
    return 'SALUDO';
  }
  
  // Everything else goes to LLM for better understanding with full context
  // The LLM can distinguish between:
  // - "Tiene el vestido Camila disponible?" → CATALOGO
  // - "Tienen disponible para el martes?" → AGENDAR_NUEVA
  // - "¿Cuánto cuesta?" → PRECIOS
  // - etc.
  
  // No match found - return null to use LLM
  return null;
}

module.exports = {
  classifyIntentWithRules
};
