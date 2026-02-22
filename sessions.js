/**
 * Session Management Module
 * 
 * Manages conversation state per WhatsApp phone number.
 * Uses in-memory Map for storage (can be upgraded to Redis later).
 */

// In-memory storage for sessions
const sessions = new Map();

/**
 * Session structure:
 * {
 *   nombre_novia: string | null,
 *   fecha_boda: string | null,
 *   fecha_cita: string | null,  // Fecha para agendar la cita (diferente de fecha_boda)
 *   etapa: 'primer_contacto' | 'interesada' | 'cita_agendada',
 *   historial: Array<{role: string, content: string}>,
 *   ultima_actividad: Date (ISO string),
 *   slots_disponibles: Array | null,  // Slots disponibles cuando se consulta disponibilidad
 *   fecha_cita_solicitada: string | null  // Fecha que se consultó para agendar
 * }
 */

/**
 * Get or create a session for a phone number
 * @param {string} phone - Phone number (cleaned, numbers only)
 * @returns {Object} Session object
 */
function getSession(phone) {
  // Clean phone number (ensure it's just numbers)
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (!sessions.has(cleanPhone)) {
    // Create new session with default values
    const newSession = {
      nombre_novia: null,
      fecha_boda: null,
      fecha_cita: null,
      etapa: 'primer_contacto',
      historial: [],
      ultima_actividad: new Date().toISOString(),
      slots_disponibles: null,
      fecha_cita_solicitada: null
    };
    sessions.set(cleanPhone, newSession);
    console.log(`📝 Nueva sesión creada para: ${cleanPhone}`);
    return newSession;
  }
  
  // Update last activity timestamp
  const session = sessions.get(cleanPhone);
  session.ultima_actividad = new Date().toISOString();
  
  return session;
}

/**
 * Update session data
 * @param {string} phone - Phone number (cleaned, numbers only)
 * @param {Object} data - Data to update (partial session object)
 * @returns {Object} Updated session object
 */
function updateSession(phone, data) {
  const cleanPhone = phone.replace(/\D/g, '');
  const session = getSession(cleanPhone);
  
  // Validate etapa if provided
  if (data.etapa && !['primer_contacto', 'interesada', 'cita_agendada'].includes(data.etapa)) {
    console.warn(`⚠️  Etapa inválida: ${data.etapa}. Usando valor por defecto.`);
    delete data.etapa;
  }
  
  // Update session with provided data
  Object.assign(session, data);
  
  // Always update last activity timestamp
  session.ultima_actividad = new Date().toISOString();
  
  console.log(`📝 Sesión actualizada para: ${cleanPhone}`, {
    etapa: session.etapa,
    nombre_novia: session.nombre_novia,
    fecha_boda: session.fecha_boda,
    fecha_cita: session.fecha_cita
  });
  
  return session;
}

/**
 * Add a message to session history
 * @param {string} phone - Phone number
 * @param {string} role - Message role ('user' | 'assistant' | 'system')
 * @param {string} content - Message content
 */
function addToHistory(phone, role, content) {
  const session = getSession(phone);
  
  if (!['user', 'assistant', 'system'].includes(role)) {
    console.warn(`⚠️  Rol inválido: ${role}. Usando 'user' por defecto.`);
    role = 'user';
  }
  
  session.historial.push({
    role,
    content,
    timestamp: new Date().toISOString()
  });
  
  // Limit history to last 50 messages to prevent memory issues
  if (session.historial.length > 50) {
    session.historial = session.historial.slice(-50);
  }
  
  session.ultima_actividad = new Date().toISOString();
}

/**
 * Clear/delete a session
 * @param {string} phone - Phone number
 * @returns {boolean} True if session was deleted, false if it didn't exist
 */
function clearSession(phone) {
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (sessions.has(cleanPhone)) {
    sessions.delete(cleanPhone);
    console.log(`🗑️  Sesión eliminada para: ${cleanPhone}`);
    return true;
  }
  
  return false;
}

/**
 * Get all active sessions
 * @returns {Array} Array of {phone, session} objects
 */
function getAllSessions() {
  return Array.from(sessions.entries()).map(([phone, session]) => ({
    phone,
    session
  }));
}

/**
 * Get session count
 * @returns {number} Number of active sessions
 */
function getSessionCount() {
  return sessions.size;
}

/**
 * Clear all sessions (useful for testing or cleanup)
 */
function clearAllSessions() {
  const count = sessions.size;
  sessions.clear();
  console.log(`🗑️  Todas las sesiones eliminadas (${count} sesiones)`);
}

/**
 * Get sessions older than specified hours (for cleanup)
 * @param {number} hours - Hours threshold
 * @returns {Array} Array of phone numbers with old sessions
 */
function getOldSessions(hours = 24) {
  const threshold = new Date(Date.now() - hours * 60 * 60 * 1000);
  const oldSessions = [];
  
  sessions.forEach((session, phone) => {
    const lastActivity = new Date(session.ultima_actividad);
    if (lastActivity < threshold) {
      oldSessions.push(phone);
    }
  });
  
  return oldSessions;
}

/**
 * Clean up old sessions
 * @param {number} hours - Hours threshold (default: 24)
 * @returns {number} Number of sessions cleaned up
 */
function cleanupOldSessions(hours = 24) {
  const oldSessions = getOldSessions(hours);
  oldSessions.forEach(phone => clearSession(phone));
  return oldSessions.length;
}

module.exports = {
  getSession,
  updateSession,
  clearSession,
  addToHistory,
  getAllSessions,
  getSessionCount,
  clearAllSessions,
  getOldSessions,
  cleanupOldSessions
};
