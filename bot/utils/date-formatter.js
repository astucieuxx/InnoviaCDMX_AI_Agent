/**
 * Date Formatter Utility
 * 
 * Centralized functions for parsing and formatting dates in CDMX timezone.
 * This ensures all dates are consistently displayed in Mexico City time.
 */

/**
 * Parse a date string from Google Calendar and return a Date object
 * The Date object will represent the correct moment in time, which we'll format with timeZone
 * @param {string} dateTimeStr - ISO date string from Google Calendar (e.g., "2026-03-20T11:00:00-06:00")
 * @returns {Date} Date object representing the correct moment in time
 */
function parseCalendarDate(dateTimeStr) {
  if (!dateTimeStr) return null;
  
  // Parse directly - JavaScript will handle timezone offset correctly
  // This creates a Date object representing the correct moment in time
  return new Date(dateTimeStr);
}

/**
 * Format date for display (DD/MM/YYYY) in CDMX timezone
 * @param {Date|string} dateInput - Date object or ISO string
 * @returns {string} Formatted date string (DD/MM/YYYY)
 */
function formatDateCDMX(dateInput) {
  if (!dateInput) return '';
  
  let date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    date = new Date(dateInput);
  }
  
  if (isNaN(date.getTime())) {
    console.error('Invalid date in formatDateCDMX:', dateInput);
    return '';
  }
  
  // Use toLocaleDateString with timeZone to get components in CDMX
  const parts = date.toLocaleDateString('en-US', { 
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  // Format: "MM/DD/YYYY" -> convert to "DD/MM/YYYY"
  const match = parts.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (match) {
    const [, month, day, year] = match;
    return `${day}/${month}/${year}`;
  }
  
  // Fallback
  return parts;
}

/**
 * Format time for display (HH:MM AM/PM) in CDMX timezone
 * @param {Date|string} dateInput - Date object or ISO string
 * @returns {string} Formatted time string (e.g., "11:00 AM")
 */
function formatTimeCDMX(dateInput) {
  if (!dateInput) return '';
  
  let date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    date = new Date(dateInput);
  }
  
  if (isNaN(date.getTime())) {
    console.error('Invalid date in formatTimeCDMX:', dateInput);
    return '';
  }
  
  // Use toLocaleTimeString with timeZone to format in CDMX
  return date.toLocaleTimeString('es-MX', { 
    timeZone: 'America/Mexico_City',
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true 
  });
}

/**
 * Format date in Spanish format (e.g., "Viernes, 20 de marzo 2026") in CDMX timezone
 * @param {Date|string} dateInput - Date object or ISO string
 * @returns {string} Formatted date string in Spanish
 */
function formatDateSpanishCDMX(dateInput) {
  if (!dateInput) return '';
  
  let date;
  if (dateInput instanceof Date) {
    date = dateInput;
  } else {
    date = new Date(dateInput);
  }
  
  if (isNaN(date.getTime())) {
    console.error('Invalid date in formatDateSpanishCDMX:', dateInput);
    return '';
  }
  
  const dayOfWeekNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 
                      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  
  // Use toLocaleDateString with timeZone to get components in CDMX
  const dateStr = date.toLocaleDateString('en-US', { 
    timeZone: 'America/Mexico_City',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Parse the formatted string (e.g., "Friday, March 20, 2026")
  const match = dateStr.match(/(\w+), (\w+) (\d+), (\d+)/);
  if (match) {
    const [, weekdayEn, monthEn, day, year] = match;
    // Convert weekday and month to Spanish
    const weekdayMap = {
      'Sunday': 'domingo', 'Monday': 'lunes', 'Tuesday': 'martes', 'Wednesday': 'miércoles',
      'Thursday': 'jueves', 'Friday': 'viernes', 'Saturday': 'sábado'
    };
    const monthMap = {
      'January': 'enero', 'February': 'febrero', 'March': 'marzo', 'April': 'abril',
      'May': 'mayo', 'June': 'junio', 'July': 'julio', 'August': 'agosto',
      'September': 'septiembre', 'October': 'octubre', 'November': 'noviembre', 'December': 'diciembre'
    };
    const dayOfWeek = weekdayMap[weekdayEn] || dayOfWeekNames[date.getDay()];
    const month = monthMap[monthEn] || monthNames[date.getMonth()];
    
    // Capitalize first letter
    const capitalizedDayOfWeek = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
    
    return `${capitalizedDayOfWeek}, ${parseInt(day)} de ${month} ${year}`;
  }
  
  // Fallback
  const dayOfWeek = dayOfWeekNames[date.getDay()];
  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  const capitalizedDayOfWeek = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
  
  return `${capitalizedDayOfWeek}, ${day} de ${month} ${year}`;
}

module.exports = {
  parseCalendarDate,
  formatDateCDMX,
  formatTimeCDMX,
  formatDateSpanishCDMX
};
