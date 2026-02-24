/**
 * Intent Classifier
 * 
 * Classifies user messages into one of 8 possible intents.
 * Uses rule-based classification first, falls back to OpenAI for ambiguous cases.
 */

const OpenAI = require('openai');
const { classifyIntentWithRules } = require('./classifier-rules');

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

// Valid intent values (must match exactly)
const VALID_INTENTS = [
  'SALUDO',
  'INFORMACION',
  'CATALOGO',
  'PRECIOS',
  'UBICACION',
  'AGENDAR_NUEVA',
  'CAMBIAR_CITA',
  'CANCELAR_CITA',
  'OTRO'
];

/**
 * Classify user intent from message and session context
 * @param {string} message - User's message
 * @param {Object} session - Session object with historial, etapa, etc.
 * @returns {Promise<string>} One of the 8 valid intents
 */
async function classifyIntent(message, session) {
  try {
    // STEP 1: Try rule-based classification first (only for very obvious cases)
    // Rules are now very conservative - they only handle clear cases like button clicks,
    // explicit keywords in specific contexts, etc. Everything else goes to LLM.
    const ruleBasedIntent = classifyIntentWithRules(message, session);
    if (ruleBasedIntent) {
      console.log(`✅ Intent clasificado por reglas (caso obvio): ${ruleBasedIntent}`);
      return ruleBasedIntent;
    }
    
    // STEP 2: Use LLM for all other cases (including ambiguous ones)
    // LLM has access to full conversation context and can make better decisions
    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️  OPENAI_API_KEY no configurado, usando OTRO como intent por defecto');
      return 'OTRO';
    }
    
    console.log('🤖 Usando LLM para clasificar intent (con contexto completo de conversación)...');

    // Import name utilities for consistent name handling
    const { getClientName } = require('./utils/name-utils');
    
    // Build context about the session state
    const sessionContext = [];
    const nombreCliente = getClientName(session);
    if (nombreCliente) {
      sessionContext.push(`Nombre del cliente: ${nombreCliente}`);
    }
    if (session.fecha_boda) {
      sessionContext.push(`Fecha de boda: ${session.fecha_boda}`);
    }
    if (session.etapa === 'cita_agendada') {
      sessionContext.push('Estado: Ya hay una cita agendada');
    }
    if (session.slots_disponibles && session.slots_disponibles.length > 0) {
      sessionContext.push('Estado: Se le mostraron horarios disponibles al usuario');
    }
    if (session.slots_tarde && session.slots_tarde.length > 0) {
      sessionContext.push('Estado: El bot preguntó si quiere ver opciones de tarde y está esperando respuesta');
    }
    if (session.slots_medio_dia && session.slots_medio_dia.length > 0) {
      sessionContext.push('Estado: El bot preguntó si quiere ver opciones de medio día y está esperando respuesta');
    }

    const contextString = sessionContext.length > 0 
      ? `\n\nCONTEXTO DE LA SESIÓN:\n${sessionContext.join('\n')}`
      : '';

    // Build classification prompt
    const systemPrompt = `Eres un clasificador de intenciones para un bot de WhatsApp de una boutique de vestidos de novia.

IMPORTANTE: El bot es neutral en género - puede atender tanto a novias como a novios o cualquier cliente.

Tu tarea es clasificar el mensaje del usuario en UNA de estas 9 categorías:

1. SALUDO: Saludos iniciales, "hola", "buenos días", "buenas tardes", inicio de conversación sin contexto previo, agradecimientos como "gracias", "muchas gracias"
2. INFORMACION: Preguntas generales sobre la boutique, qué hacen, servicios, experiencia
3. CATALOGO: Peticiones para ver modelos, vestidos, colección, catálogo, fotos
4. PRECIOS: Preguntas sobre precios, costos, cuánto cuesta, presupuesto
5. UBICACION: Preguntas sobre dónde están, dirección, cómo llegar, ubicación
6. AGENDAR_NUEVA: Expresan deseo de agendar una NUEVA cita, visitar el showroom, "quiero una cita", "tienen disponible [para cita/horario]", mencionan fechas para visitar (cuando NO hay cita existente). IMPORTANTE: Si preguntan "tiene disponible [un vestido/modelo]" o "¿tiene el vestido X disponible?", es CATALOGO, NO AGENDAR_NUEVA
7. CAMBIAR_CITA: El usuario quiere cambiar/reagendar una cita existente, "reagendar", "otra fecha", "cambiar fecha", "mover cita", "quiero cambiar mi cita", "quiero cambiar", "cambiar mi cita"
8. CANCELAR_CITA: El usuario quiere cancelar una cita existente, "cancelar", "no puedo", "no voy", "no asistiré"
9. OTRO: Cualquier otra cosa que no encaje en las categorías anteriores

REGLAS IMPORTANTES:
- PRIORIDAD ABSOLUTA (MÁS IMPORTANTE): Si el usuario NO tiene nombre_cliente/nombre_novia O (tiene nombre pero NO tiene fecha_boda Y NO ha declinado la fecha), CUALQUIER mensaje debe clasificarse como SALUDO para completar el flujo de recolección de información. Esto incluye fechas, nombres, preguntas sobre catálogo, precios, ubicación, o cualquier otra cosa. El flujo de recolección DEBE completarse ANTES de permitir otros intents. NO clasifiques como AGENDAR_NUEVA, CATALOGO, PRECIOS, UBICACION, etc. si el usuario aún no ha completado el flujo de recolección de información.
- Si la sesión indica que ya hay una cita agendada (etapa: cita_agendada o calendar_event_id existe):
  - Si el usuario escribe "cancelar", "no puedo", "no voy", "no asistiré", clasifica como CANCELAR_CITA
  - Si el usuario escribe "reagendar", "otra fecha", "cambiar fecha", "mover", clasifica como CAMBIAR_CITA
- Si NO hay cita agendada y el usuario quiere agendar, clasifica como AGENDAR_NUEVA
- Si el usuario dice "gracias", "muchas gracias", "ok", "perfecto" después de completar una acción, clasifica como SALUDO (no es una acción nueva)
- Si la sesión tiene slots_tarde y el usuario dice "sí", "tarde", "quiero ver", "muéstrame", "opciones de tarde", "por la tarde", clasifica como AGENDAR_NUEVA (quiere ver opciones de tarde)
- Si la sesión tiene slots_medio_dia y el usuario dice "sí", "medio día", "mañana", "quiero ver", "muéstrame", clasifica como AGENDAR_NUEVA (quiere ver opciones de medio día)
- Si el usuario menciona una fecha específica para visitar (ej: "tienen libre el martes 24") y NO hay cita existente y NO está en flujo de recolección de información, clasifica como AGENDAR_NUEVA
- Si el usuario está proporcionando información solicitada (nombre completo, fecha de boda) en respuesta a una pregunta del bot, clasifica como SALUDO (es parte del flujo inicial)
- Si el bot acaba de preguntar por nombre o fecha de boda y el usuario responde con esa información, clasifica como SALUDO
- Si el usuario pregunta "qué días tienen disponible" o "cuándo puedo ir", clasifica como AGENDAR_NUEVA
- Si el usuario pregunta sobre disponibilidad de un VESTIDO o MODELO específico (ej: "¿tiene el vestido Camila disponible?", "¿tienen disponible el modelo X?"), clasifica como CATALOGO (no AGENDAR_NUEVA)
- Si el usuario pregunta "dónde están" o "cómo llegar", clasifica como UBICACION
- Si el usuario pregunta "cuánto cuesta" o "precio", clasifica como PRECIOS
- Si el usuario pide ver "vestidos", "modelos", "catálogo", clasifica como CATALOGO
- Si el mensaje contiene solo una fecha (ej: "10 julio 2026", "24 de febrero") y la sesión no tiene fecha_boda aún y está en flujo de recolección, clasifica como SALUDO (el usuario está proporcionando la fecha de boda solicitada)

Responde SOLO con una de estas 9 palabras (en mayúsculas):
SALUDO | INFORMACION | CATALOGO | PRECIOS | UBICACION | AGENDAR_NUEVA | CAMBIAR_CITA | CANCELAR_CITA | OTRO

No agregues explicaciones, solo la palabra.`;

    // Include recent conversation history for better context understanding
    // Use last 8 messages (4 exchanges) to give LLM better context
    // If conversation is very long, include a summary of earlier messages
    const totalMessages = session.historial?.length || 0;
    const recentMessages = session.historial?.slice(-8) || [];
    
    let historyContext = '';
    
    if (recentMessages.length > 0) {
      const recentHistory = recentMessages.map(msg => 
        `${msg.role === 'user' ? 'Usuario' : 'Bot'}: ${msg.content}`
      ).join('\n');
      
      historyContext = `\n\nÚLTIMOS MENSAJES DE LA CONVERSACIÓN (${recentMessages.length} de ${totalMessages} total):\n${recentHistory}`;
      
      // If conversation is very long, add a note about earlier context
      if (totalMessages > 10) {
        const earlierMessages = session.historial.slice(0, -8);
        const earlierSummary = earlierMessages
          .filter(msg => msg.role === 'user')
          .slice(0, 3)
          .map(msg => msg.content.substring(0, 50))
          .join('; ');
        
        if (earlierSummary) {
          historyContext += `\n\n(Nota: Hay ${totalMessages - 8} mensajes anteriores en la conversación. Temas mencionados anteriormente: ${earlierSummary}...)`;
        }
      }
    }

    const fullPrompt = `${systemPrompt}${contextString}${historyContext}

MENSAJE ACTUAL DEL USUARIO:
${message}

INTENT:`;

    console.log(`🔍 Clasificando intent para mensaje: "${message.substring(0, 50)}..."`);

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: fullPrompt }
      ],
      max_tokens: 10, // Very short response, just the intent word
      temperature: 0 // Deterministic classification
    });

    const intent = response.choices[0].message.content.trim().toUpperCase();

    // Validate intent is one of the valid values
    if (VALID_INTENTS.includes(intent)) {
      console.log(`✅ Intent clasificado: ${intent}`);
      return intent;
    } else {
      // If OpenAI returns something unexpected, try to match it
      console.warn(`⚠️  Intent inesperado de OpenAI: "${intent}", normalizando...`);
      
      // Try to find a match (case-insensitive, partial match)
      const matchedIntent = VALID_INTENTS.find(valid => 
        intent.includes(valid) || valid.includes(intent)
      );
      
      if (matchedIntent) {
        console.log(`✅ Intent normalizado a: ${matchedIntent}`);
        return matchedIntent;
      }
      
      // Default to OTRO if no match
      console.warn(`⚠️  No se pudo normalizar el intent, usando OTRO`);
      return 'OTRO';
    }
  } catch (error) {
    console.error('❌ Error clasificando intent:', error.message);
    // Default to OTRO on error
    return 'OTRO';
  }
}

module.exports = {
  classifyIntent,
  VALID_INTENTS
};
