/**
 * Date Parser Utility
 * 
 * Helper functions to parse and normalize dates from user messages.
 */

/**
 * Parse date from Spanish text
 * Examples: "24 de febrero", "martes 24 de febrero", "24/02/2025"
 * @param {string} text - Text containing date
 * @returns {string|null} Date in YYYY-MM-DD format or null
 */
function parseDateFromText(text) {
  if (!text) return null;
  
  const months = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4, 'mayo': 5, 'junio': 6,
    'julio': 7, 'agosto': 8, 'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
  };
  
  const textLower = text.toLowerCase();
  const currentYear = new Date().getFullYear();
  
  // Pattern 1: "24 de febrero" o "24 de febrero de 2025"
  const pattern1 = /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?/i;
  const match1 = textLower.match(pattern1);
  if (match1) {
    const day = parseInt(match1[1]);
    const monthName = match1[2];
    const year = match1[3] ? parseInt(match1[3]) : currentYear;
    const month = months[monthName.toLowerCase()];
    
    if (month && day >= 1 && day <= 31) {
      const monthStr = String(month).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      return `${year}-${monthStr}-${dayStr}`;
    }
  }
  
  // Pattern 2: "martes 24 de febrero"
  const pattern2 = /(?:lunes|martes|miércoles|jueves|viernes|sábado|domingo)\s+(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?:\s+de\s+(\d{4}))?/i;
  const match2 = textLower.match(pattern2);
  if (match2) {
    const day = parseInt(match2[1]);
    const monthName = match2[2];
    const year = match2[3] ? parseInt(match2[3]) : currentYear;
    const month = months[monthName.toLowerCase()];
    
    if (month && day >= 1 && day <= 31) {
      const monthStr = String(month).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      return `${year}-${monthStr}-${dayStr}`;
    }
  }
  
  // Pattern 3: YYYY-MM-DD
  const pattern3 = /(\d{4})-(\d{2})-(\d{2})/;
  const match3 = text.match(pattern3);
  if (match3) {
    return match3[0];
  }
  
  // Pattern 4: DD/MM/YYYY o DD/MM/YY
  const pattern4 = /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/;
  const match4 = text.match(pattern4);
  if (match4) {
    let day = parseInt(match4[1]);
    let month = parseInt(match4[2]);
    let year = parseInt(match4[3]);
    
    if (year < 100) {
      year = 2000 + year;
    }
    
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const monthStr = String(month).padStart(2, '0');
      const dayStr = String(day).padStart(2, '0');
      return `${year}-${monthStr}-${dayStr}`;
    }
  }
  
  // Pattern 5: Try JavaScript Date parser as last resort
  try {
    const dateObj = new Date(text);
    if (!isNaN(dateObj.getTime())) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (e) {
    // Ignore
  }
  
  return null;
}

/**
 * Extract appointment date from message
 * Looks for date patterns that indicate when user wants to schedule
 * @param {string} message - User message
 * @returns {string|null} Date in YYYY-MM-DD format or null
 */
function extractAppointmentDate(message) {
  if (!message) return null;
  
  // Keywords that indicate user is mentioning a date for appointment
  const appointmentKeywords = [
    'tienen libre',
    'disponible',
    'agendar',
    'cita',
    'visitar',
    'ir',
    'puedo',
    'quiero',
    'me gustaría',
    'el',
    'para el',
    'el día'
  ];
  
  const messageLower = message.toLowerCase();
  const hasAppointmentKeyword = appointmentKeywords.some(keyword => 
    messageLower.includes(keyword)
  );
  
  if (hasAppointmentKeyword) {
    return parseDateFromText(message);
  }
  
  return null;
}

module.exports = {
  parseDateFromText,
  extractAppointmentDate
};
