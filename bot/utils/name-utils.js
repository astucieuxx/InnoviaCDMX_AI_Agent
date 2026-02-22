/**
 * Name Utilities
 * 
 * Helper functions for handling client names
 */

/**
 * Get client name from session (supports both nombre_cliente and nombre_novia for backward compatibility)
 * @param {Object} session - Session object
 * @returns {string|null} Full client name or null
 */
function getClientName(session) {
  return session?.nombre_cliente || session?.nombre_novia || null;
}

/**
 * Extract first name from full name
 * @param {string} fullName - Full name (e.g., "Manuel Garza", "María José López")
 * @returns {string} First name only (e.g., "Manuel", "María")
 */
function getFirstName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return null;
  }
  
  // Trim and split by spaces
  const parts = fullName.trim().split(/\s+/);
  
  // Return first part (first name)
  return parts[0] || null;
}

/**
 * Get first name from session
 * @param {Object} session - Session object
 * @returns {string|null} First name or null
 */
function getClientFirstName(session) {
  const fullName = getClientName(session);
  if (!fullName) {
    return null;
  }
  return getFirstName(fullName);
}

module.exports = {
  getClientName,
  getFirstName,
  getClientFirstName
};
