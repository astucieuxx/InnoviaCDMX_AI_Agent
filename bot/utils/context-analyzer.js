/**
 * Context Analyzer
 * 
 * Uses LLM to analyze ambiguous user responses in different contexts.
 * Can be used by any handler to better understand user intent.
 */

const OpenAI = require('openai');

// Lazy initialization of OpenAI client (only when needed)
let openai = null;

function getOpenAIClient() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY no está configurado en las variables de entorno');
    }
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
}

/**
 * Analyze user response in a specific context using LLM
 * @param {string} message - User's message
 * @param {string} context - Context description (e.g., "wedding_date_collection", "appointment_scheduling", "cancellation_confirmation")
 * @param {Object} session - Session object with historial, etapa, etc.
 * @param {Object} options - Additional options
 * @param {string} options.expectedResponseType - What we're expecting (e.g., "date", "confirmation", "selection")
 * @param {string} options.lastBotMessage - Last message from bot to provide context
 * @param {Array} options.validOptions - Array of valid options if applicable (e.g., ["yes", "no", "cancel"])
 * @returns {Promise<Object>} Analysis result with action, extracted data, and confidence
 */
async function analyzeContextualResponse(message, context, session, options = {}) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY no configurado, usando análisis básico');
      return analyzeWithRules(message, context, options);
    }

    const {
      expectedResponseType = 'general',
      lastBotMessage = '',
      validOptions = []
    } = options;

    // Build context about the session
    const sessionContext = [];
    if (session.nombre_novia) {
      sessionContext.push(`Nombre de la novia: ${session.nombre_novia}`);
    }
    if (session.fecha_boda) {
      sessionContext.push(`Fecha de boda: ${session.fecha_boda}`);
    }
    if (session.etapa) {
      sessionContext.push(`Etapa: ${session.etapa}`);
    }
    if (session.pending_agendar_fecha) {
      sessionContext.push('El bot está esperando una fecha para agendar cita');
    }
    if (session.pending_cancel_confirmation) {
      sessionContext.push('El bot está esperando confirmación para cancelar cita');
    }
    if (session.pending_reschedule_date) {
      sessionContext.push('El bot está esperando una nueva fecha para reagendar');
    }

    const contextString = sessionContext.length > 0 
      ? `\n\nCONTEXTO DE LA SESIÓN:\n${sessionContext.join('\n')}`
      : '';

    // Get recent conversation history (more context for better understanding)
    const totalMessages = (session.historial || []).length;
    const recentMessages = (session.historial || []).slice(-8); // Last 8 messages (4 exchanges)
    
    let historyContext = '';
    
    if (recentMessages.length > 0) {
      const recentHistory = recentMessages.map(msg => 
        `${msg.role === 'user' ? 'Usuario' : 'Bot'}: ${msg.content}`
      ).join('\n');
      
      historyContext = `\n\nÚLTIMOS MENSAJES (${recentMessages.length} de ${totalMessages} total):\n${recentHistory}`;
      
      // If conversation is long, add summary of earlier context
      if (totalMessages > 10) {
        const earlierMessages = (session.historial || []).slice(0, -8);
        const earlierSummary = earlierMessages
          .filter(msg => msg.role === 'user')
          .slice(0, 3)
          .map(msg => msg.content.substring(0, 50))
          .join('; ');
        
        if (earlierSummary) {
          historyContext += `\n\n(Nota: Hay ${totalMessages - 8} mensajes anteriores. Temas anteriores: ${earlierSummary}...)`;
        }
      }
    }

    // Build context-specific prompts
    const contextPrompts = {
      name_collection: {
        system: `Eres un analizador de respuestas para un bot de WhatsApp de una boutique de vestidos de novia.

El bot acaba de preguntar al usuario por su nombre completo (nombre y apellido).

Analiza la respuesta del usuario y determina qué está haciendo:

1. PROPORCIONANDO NOMBRE: El usuario está dando su nombre completo (ej: "María García", "Soy Ana López", "Me llamo Sofía Martínez")
2. PROPORCIONANDO SOLO PRIMER NOMBRE: El usuario solo dio su primer nombre (ej: "María", "Soy Ana", "Me llamo Sofía")
3. DECLINANDO: El usuario indica que NO quiere compartir su nombre
4. OTRA COSA: El usuario está haciendo una pregunta, pidiendo información, o hablando de otra cosa

Responde SOLO con un objeto JSON válido en este formato:
{
  "action": "provide_name" | "provide_first_name" | "decline_name" | "other",
  "extractedValue": "nombre completo" o null (solo si action es "provide_name" o "provide_first_name"),
  "reason": "breve razón" o null,
  "confidence": "high" | "medium" | "low"
}

IMPORTANTE:
- Si el usuario proporciona un nombre, extrae el nombre completo si está disponible
- Si solo proporciona el primer nombre, usa "provide_first_name" pero igual extrae el valor
- Si el usuario declina, action debe ser "decline_name"
- Si no está claro, usa "other"`,
        user: `Bot preguntó: "${lastBotMessage || '¿Me compartes tu nombre completo?'}"\n\nUsuario responde: "${message}"${contextString}${historyContext}\n\nAnaliza la respuesta del usuario.`
      },
      wedding_date_collection: {
        system: `Eres un analizador de respuestas para un bot de WhatsApp de una boutique de vestidos de novia.

El bot acaba de preguntar al usuario por la fecha completa de su boda (día, mes y año).

Analiza la respuesta del usuario y determina qué está haciendo:

1. PROPORCIONANDO FECHA: El usuario está dando una fecha de boda (ej: "10 de julio 2026", "el 24 de febrero 2026", "15/03/2026")
2. DECLINANDO: El usuario indica que NO tiene la fecha, NO la quiere compartir, o NO la ha decidido (ej: "aún no", "no la tengo", "todavía no está definida", "más adelante", "no quiero compartirla")
3. OTRA COSA: El usuario está haciendo una pregunta, pidiendo información, o hablando de otra cosa

Responde SOLO con un objeto JSON válido en este formato:
{
  "action": "provide_date" | "decline_date" | "other",
  "date": "YYYY-MM-DD" o null (solo si action es "provide_date" y puedes extraer la fecha),
  "reason": "breve razón" o null,
  "confidence": "high" | "medium" | "low"
}

IMPORTANTE:
- Si el usuario proporciona una fecha, extrae la fecha en formato YYYY-MM-DD (asume año 2026 si no se especifica)
- Si el usuario declina, action debe ser "decline_date"
- Si no está claro, usa "other"
- NO inventes fechas si el usuario no las proporciona
- Si el usuario dice "aún no", "no la tengo", "todavía no", "más adelante", etc., es "decline_date"`,
        user: `Bot preguntó: "${lastBotMessage}"\n\nUsuario responde: "${message}"${contextString}${historyContext}\n\nAnaliza la respuesta del usuario.`
      },
      appointment_scheduling: {
        system: `Eres un analizador de respuestas para un bot de WhatsApp de una boutique de vestidos de novia.

El bot está en el proceso de agendar una cita y acaba de preguntar al usuario por una fecha o está esperando que seleccione un horario.

Analiza la respuesta del usuario y determina qué está haciendo:

1. PROPORCIONANDO FECHA: El usuario está dando una fecha para la cita (ej: "5 de marzo", "el 10 de julio", "15/03/2026")
2. SELECCIONANDO HORARIO: El usuario está seleccionando un horario de los mostrados (ej: "el 1", "opción 2", "el tercero")
3. PREGUNTANDO: El usuario está haciendo una pregunta sobre disponibilidad, horarios, etc.
4. CANCELANDO: El usuario quiere cancelar el proceso de agendamiento
5. OTRA COSA: El usuario está hablando de otra cosa

Responde SOLO con un objeto JSON válido en este formato:
{
  "action": "provide_date" | "select_slot" | "question" | "cancel" | "other",
  "date": "YYYY-MM-DD" o null (solo si action es "provide_date"),
  "slot_number": número o null (solo si action es "select_slot"),
  "reason": "breve razón" o null,
  "confidence": "high" | "medium" | "low"
}`,
        user: `Bot preguntó: "${lastBotMessage}"\n\nUsuario responde: "${message}"${contextString}${historyContext}\n\nAnaliza la respuesta del usuario.`
      },
      cancellation_confirmation: {
        system: `Eres un analizador de respuestas para un bot de WhatsApp de una boutique de vestidos de novia.

El bot acaba de mostrar los detalles de una cita y preguntó si el usuario confirma que quiere cancelarla.

Analiza la respuesta del usuario y determina:

1. CONFIRMANDO: El usuario confirma que quiere cancelar (ej: "sí", "confirmo", "cancelar", "sí cancelar")
2. NEGANDO: El usuario NO quiere cancelar (ej: "no", "mejor no", "no cancelar", "déjalo así")
3. PREGUNTANDO: El usuario está haciendo una pregunta sobre la cancelación
4. OTRA COSA: El usuario está hablando de otra cosa

Responde SOLO con un objeto JSON válido en este formato:
{
  "action": "confirm" | "deny" | "question" | "other",
  "reason": "breve razón" o null,
  "confidence": "high" | "medium" | "low"
}`,
        user: `Bot preguntó: "${lastBotMessage}"\n\nUsuario responde: "${message}"${contextString}${historyContext}\n\nAnaliza la respuesta del usuario.`
      },
      general: {
        system: `Eres un analizador de respuestas para un bot de WhatsApp de una boutique de vestidos de novia.

Analiza la respuesta del usuario en el contexto actual y determina su intención.

Responde SOLO con un objeto JSON válido en este formato:
{
  "action": "proceed" | "decline" | "question" | "other",
  "extracted_data": {} o null,
  "reason": "breve razón" o null,
  "confidence": "high" | "medium" | "low"
}`,
        user: `Usuario dice: "${message}"${contextString}${historyContext}\n\nAnaliza la respuesta del usuario.`
      }
    };

    const prompt = contextPrompts[context] || contextPrompts.general;

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      max_tokens: 200,
      temperature: 0.1
    });

    const extractedText = response.choices[0].message.content.trim();
    
    // Parse JSON (might be wrapped in code blocks)
    let result;
    try {
      const jsonText = extractedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      result = JSON.parse(jsonText);
    } catch (parseError) {
      console.warn('⚠️  Error parseando JSON del análisis de contexto, usando reglas:', parseError);
      return analyzeWithRules(message, context, options);
    }

    // Validate and normalize result
    if (result.date && !result.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      // Try to normalize date
      try {
        const dateObj = new Date(result.date);
        if (!isNaN(dateObj.getTime())) {
          const year = dateObj.getFullYear();
          const month = String(dateObj.getMonth() + 1).padStart(2, '0');
          const day = String(dateObj.getDate()).padStart(2, '0');
          result.date = `${year}-${month}-${day}`;
        } else {
          result.date = null;
        }
      } catch (e) {
        result.date = null;
      }
    }

    console.log(`🤖 LLM analizó respuesta en contexto "${context}": ${result.action}${result.date ? ` (${result.date})` : ''} [${result.confidence || 'medium'}]`);
    return result;
  } catch (error) {
    console.error(`❌ Error usando LLM para analizar contexto "${context}":`, error.message);
    // Fallback to rule-based
    return analyzeWithRules(message, context, options);
  }
}

/**
 * Fallback rule-based analysis when LLM is not available
 */
function analyzeWithRules(message, context, options) {
  const msg = message.toLowerCase().trim();
  const { validOptions = [] } = options;

  switch (context) {
    case 'name_collection':
      // Check for name patterns (2+ words likely to be full name)
      const namePattern = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+/;
      if (namePattern.test(message.trim())) {
        return { action: 'provide_name', extractedValue: message.trim(), reason: null, confidence: 'high' };
      }
      
      // Check for single name (first name only)
      const firstNamePattern = /^(?:me\s+llamo|soy|mi\s+nombre\s+es)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)/i;
      const firstNameMatch = message.match(firstNamePattern);
      if (firstNameMatch) {
        return { action: 'provide_first_name', extractedValue: firstNameMatch[1], reason: null, confidence: 'medium' };
      }
      
      // Check for simple name (single word, capitalized)
      const simpleName = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/;
      if (simpleName.test(message.trim())) {
        return { action: 'provide_first_name', extractedValue: message.trim(), reason: null, confidence: 'medium' };
      }
      
      // Check for decline keywords
      const declineNameKeywords = ['no quiero', 'prefiero no', 'no quiero compartir'];
      if (declineNameKeywords.some(kw => msg.includes(kw))) {
        return { action: 'decline_name', extractedValue: null, reason: 'user_declined', confidence: 'high' };
      }
      
      return { action: 'other', extractedValue: null, reason: null, confidence: 'low' };

    case 'wedding_date_collection':
      // Check for date patterns
      const datePatterns = [
        /\d{1,2}\s*(?:de\s*)?(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s*(?:\d{4})?/i,
        /\d{1,2}\/\d{1,2}\/\d{4}/,
        /\d{4}-\d{2}-\d{2}/
      ];
      
      if (datePatterns.some(pattern => pattern.test(message))) {
        return { action: 'provide_date', date: null, reason: null, confidence: 'medium' };
      }
      
      // Check for decline keywords
      const declineKeywords = [
        'no tengo', 'aún no', 'aun no', 'todavía no', 'todavia no',
        'no la tengo', 'no sé', 'no se', 'no lo sé', 'no lo se',
        'no he decidido', 'no he definido', 'no está definida', 'no esta definida',
        'no está decidida', 'no esta decidida', 'más adelante', 'mas adelante',
        'después', 'despues', 'luego', 'no quiero', 'prefiero no'
      ];
      
      if (declineKeywords.some(kw => msg.includes(kw))) {
        return { action: 'decline_date', date: null, reason: 'user_indicated_no_date', confidence: 'high' };
      }
      
      return { action: 'other', date: null, reason: null, confidence: 'low' };

    case 'appointment_scheduling':
      // Check for date patterns
      if (datePatterns.some(pattern => pattern.test(message))) {
        return { action: 'provide_date', date: null, reason: null, confidence: 'medium' };
      }
      
      // Check for slot selection (numbers)
      const slotMatch = msg.match(/\d+/);
      if (slotMatch) {
        return { action: 'select_slot', slot_number: parseInt(slotMatch[0]), reason: null, confidence: 'high' };
      }
      
      // Check for cancellation
      if (msg.includes('cancelar') || msg.includes('no quiero') || msg.includes('mejor no')) {
        return { action: 'cancel', reason: null, confidence: 'medium' };
      }
      
      return { action: 'other', reason: null, confidence: 'low' };

    case 'cancellation_confirmation':
      // Check for confirmation
      const confirmKeywords = ['sí', 'si', 'confirmo', 'confirmar', 'cancelar', 'adelante'];
      if (confirmKeywords.some(kw => msg.includes(kw)) && !msg.includes('no')) {
        return { action: 'confirm', reason: null, confidence: 'high' };
      }
      
      // Check for denial
      if (msg.includes('no') && !msg.includes('cancelar')) {
        return { action: 'deny', reason: null, confidence: 'high' };
      }
      
      return { action: 'other', reason: null, confidence: 'low' };

    default:
      return { action: 'other', reason: null, confidence: 'low' };
  }
}

module.exports = {
  analyzeContextualResponse
};
