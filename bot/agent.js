/**
 * Conversational Agent
 *
 * Replaces the intent classification + handler pipeline with a single
 * LLM agent that:
 *  1. Receives the full conversation context.
 *  2. Decides whether to call a Google Calendar tool or answer directly.
 *  3. Generates every response in natural language.
 */

const OpenAI = require('openai');
const {
  getBusinessInfo,
  getBusinessHours,
  getCatalogInfo,
  getPricingInfo
} = require('../config');
const {
  getAvailableSlots,
  createCalendarEvent: createCalendarEventService,
  deleteCalendarEvent: deleteCalendarEventService,
  updateCalendarEvent: updateCalendarEventService,
  restoreBlueEvent: restoreBlueEventService,
  getCalendarEvent: getCalendarEventService
} = require('./calendar-service');
const { getClientName } = require('./utils/name-utils');

// ---------------------------------------------------------------------------
// OpenAI client (lazy)
// ---------------------------------------------------------------------------
let openai = null;
function getOpenAIClient() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY no está configurado en las variables de entorno');
    }
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'buscar_slots_disponibles',
      description:
        'Consulta los horarios disponibles en Google Calendar para una fecha específica. ' +
        'Úsala cuando la clienta quiera saber qué horarios hay disponibles para su cita.',
      parameters: {
        type: 'object',
        properties: {
          fecha: {
            type: 'string',
            description: 'Fecha en formato YYYY-MM-DD'
          }
        },
        required: ['fecha']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'confirmar_cita',
      description:
        'Crea una cita confirmada en Google Calendar. ' +
        'Úsala SOLO cuando la clienta haya elegido un horario específico y confirmado que quiere agendarse.',
      parameters: {
        type: 'object',
        properties: {
          hora_inicio: {
            type: 'string',
            description:
              'Fecha y hora de inicio de la cita en formato ISO 8601 con zona horaria de México, ' +
              'p. ej. 2026-03-15T11:00:00-06:00'
          },
          nombre_cliente: {
            type: 'string',
            description: 'Nombre completo de la clienta'
          },
          telefono: {
            type: 'string',
            description: 'Número de teléfono de la clienta'
          },
          fecha_boda: {
            type: 'string',
            description: 'Fecha de boda de la clienta en formato YYYY-MM-DD. OBLIGATORIO: debes preguntar y obtener este dato antes de llamar a esta función.'
          }
        },
        required: ['hora_inicio', 'nombre_cliente', 'telefono', 'fecha_boda']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'cancelar_cita',
      description: 'Cancela una cita existente en Google Calendar.',
      parameters: {
        type: 'object',
        properties: {
          event_id: {
            type: 'string',
            description: 'ID del evento de Google Calendar a cancelar'
          }
        },
        required: ['event_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'reagendar_cita',
      description:
        'Mueve una cita existente a una nueva fecha y hora en Google Calendar.',
      parameters: {
        type: 'object',
        properties: {
          event_id: {
            type: 'string',
            description: 'ID del evento de Google Calendar a reagendar'
          },
          nueva_hora_inicio: {
            type: 'string',
            description: 'Nueva fecha y hora de inicio en formato ISO 8601 con zona horaria de México'
          }
        },
        required: ['event_id', 'nueva_hora_inicio']
      }
    }
  }
];

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------
function buildSystemPrompt(session, phone) {
  const biz = getBusinessInfo();
  const hours = getBusinessHours();
  const catalog = getCatalogInfo();
  const pricing = getPricingInfo();
  const clientName = getClientName(session);

  const today = new Date().toLocaleDateString('es-MX', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Mexico_City'
  });

  const slotsInfo =
    session.slots_disponibles && session.slots_disponibles.length > 0
      ? `- **Horarios mostrados recientemente:** ${session.slots_disponibles
          .map((s, i) => `${i + 1}. ${s.time} (inicio ISO: ${s.start})`)
          .join(', ')}`
      : '';

  return `Eres ${biz.asesora_nombre || 'la asesora'} de ${biz.nombre}, una boutique de vestidos de novia ubicada en CDMX. Atiendes a clientas por WhatsApp de forma cálida, personal y completamente conversacional.

## Información del negocio
- **Nombre:** ${biz.nombre}
- **Dirección:** ${biz.direccion}
- **Horarios:** Martes a sábado ${hours.martes_sabado || '11am – 8pm'}, domingos ${hours.domingos || '11am – 6pm'}, lunes cerrado
- **Catálogo:** ${catalog.nombre || 'Colección 2026'} → ${catalog.link || ''}
- **Precio base:** $${(pricing.precio_base || 25000).toLocaleString()} MXN
- **Nota precios:** ${pricing.nota || 'Los precios varían según modelo y personalizaciones'}

## Contexto de la clienta
- **Teléfono:** ${phone}
- **Nombre:** ${clientName || 'No proporcionado aún'}
- **Fecha de boda:** ${session.fecha_boda || 'No proporcionada aún'}
- **Cita agendada (ID en calendario):** ${session.calendar_event_id || 'Ninguna'}
${slotsInfo}

## Fecha de hoy
Hoy es ${today}.

## Instrucciones de comportamiento
1. **Genera siempre la respuesta en lenguaje natural.** Nunca copies mensajes predefinidos o rígidos.
2. **Usa el nombre de la clienta** en cuanto lo tengas.
3. **Objetivo principal:** convertir cada conversación en una cita agendada en el showroom.
4. **Recopila datos gradualmente:** primero el nombre, luego la fecha de boda, después propón agendar.
5. **Para agendar una cita:**
   - Pide la fecha que prefiere la clienta.
   - Llama a \`buscar_slots_disponibles\` para ver disponibilidad.
   - Muestra los horarios disponibles de forma clara y amigable.
   - **ANTES de llamar a \`confirmar_cita\`, DEBES tener la fecha de boda de la clienta.** Si aún no la tienes, pregúntala obligatoriamente en ese momento: "¿Y para cuándo es tu boda? 💍" (o variación natural). No puedes confirmar la cita sin este dato.
   - Cuando la clienta confirme un horario específico Y ya tengas su fecha de boda, llama a \`confirmar_cita\`.
6. **Para cancelar:** ANTES de llamar a \`cancelar_cita\`, DEBES mostrarle a la clienta los detalles de la cita que encontraste (fecha, hora) y preguntarle si está segura de que quiere cancelar. Ejemplo: "Encontré tu cita: está programada para el [día] a las [hora]. ¿Estás segura de que deseas cancelarla? 🤍". Solo llama a \`cancelar_cita\` cuando la clienta confirme explícitamente que sí quiere cancelar. El event_id lo tienes disponible en el contexto de la clienta.
7. **Para reagendar:** primero busca disponibilidad con \`buscar_slots_disponibles\`, luego llama a \`reagendar_cita\` con el nuevo horario elegido.
8. **Para preguntas generales:** responde directamente sin forzar un flujo de agendamiento.
9. **Tono:** cálido, emocionante, personal. Como una amiga experta en bodas. Usa emojis con moderación (👰‍♀️ ✨ 💐 🤍).
10. **Nunca** des precios exactos por modelo (solo el precio base), ni confirmes disponibilidad sin verificar con herramientas.
11. **Responde siempre en español.**
12. **Mensajes concisos:** WhatsApp no es email; evita respuestas largas o con demasiados párrafos.`;
}

// ---------------------------------------------------------------------------
// Tool executor
// ---------------------------------------------------------------------------
async function executeTool(toolName, toolArgs, calendarDeps, session, phone) {
  const { calendarClient, authClient, calendarId, innoviaCDMXCalendarId } = calendarDeps;

  try {
    // ---- buscar_slots_disponibles ----------------------------------------
    if (toolName === 'buscar_slots_disponibles') {
      const { fecha } = toolArgs;
      console.log(`🔧 Agent tool: buscar_slots_disponibles(${fecha})`);

      const slots = await getAvailableSlots(
        fecha,
        calendarClient,
        authClient,
        innoviaCDMXCalendarId,
        null
      );

      const available = slots.filter(s => s.availableSpots && s.availableSpots > 0);

      return {
        fecha,
        slots_disponibles: available,
        resultado:
          available.length > 0
            ? `Hay ${available.length} horario(s) disponible(s) para ${fecha}:\n${available
                .map((s, i) => `${i + 1}. ${s.time}  (inicio: ${s.start})`)
                .join('\n')}`
            : `No hay horarios disponibles para ${fecha}.`
      };
    }

    // ---- confirmar_cita --------------------------------------------------
    if (toolName === 'confirmar_cita') {
      const { hora_inicio, nombre_cliente, telefono, fecha_boda } = toolArgs;
      console.log(`🔧 Agent tool: confirmar_cita(${nombre_cliente}, ${hora_inicio})`);

      const event = await createCalendarEventService(
        nombre_cliente,
        telefono,
        null,
        hora_inicio,
        fecha_boda || null,
        calendarClient,
        authClient,
        calendarId
      );

      if (event) {
        // Eliminar el evento azul (slot disponible) del calendario Innovia CDMX
        const storedSlots = session.slots_disponibles || [];
        const appointmentTime = new Date(hora_inicio).getTime();
        const matchingSlot = storedSlots.find(slot => {
          return Math.abs(new Date(slot.start).getTime() - appointmentTime) < 60000;
        });
        if (matchingSlot && matchingSlot.eventId) {
          console.log(`🗑️  Eliminando slot azul del calendario Innovia CDMX (ID: ${matchingSlot.eventId})`);
          await deleteCalendarEventService(matchingSlot.eventId, calendarClient, authClient, innoviaCDMXCalendarId);
        } else {
          console.warn(`⚠️  No se encontró slot azul coincidente para eliminar en hora: ${hora_inicio}`);
        }

        return {
          exito: true,
          event_id: event.id,
          calendar_link: event.htmlLink || null,
          mensaje: `Cita creada exitosamente. ID: ${event.id}`
        };
      }
      return { exito: false, mensaje: 'No se pudo crear el evento en el calendario.' };
    }

    // ---- cancelar_cita ---------------------------------------------------
    if (toolName === 'cancelar_cita') {
      const { event_id } = toolArgs;
      console.log(`🔧 Agent tool: cancelar_cita(${event_id})`);

      // Obtener detalles del evento ANTES de eliminarlo para recuperar la hora
      const existingEvent = await getCalendarEventService(event_id, calendarClient, authClient, calendarId);
      const startIso = existingEvent?.start?.dateTime || existingEvent?.start?.date || null;

      await deleteCalendarEventService(event_id, calendarClient, authClient, calendarId);

      // Restaurar el slot azul en el calendario Innovia CDMX
      if (startIso) {
        console.log(`🔵 Restaurando slot azul en Innovia CDMX para: ${startIso}`);
        await restoreBlueEventService(startIso, calendarClient, authClient, innoviaCDMXCalendarId);
      } else {
        console.warn(`⚠️  No se pudo obtener la hora de inicio del evento para restaurar el slot azul`);
      }

      return { exito: true, mensaje: 'Cita cancelada exitosamente.' };
    }

    // ---- reagendar_cita --------------------------------------------------
    if (toolName === 'reagendar_cita') {
      const { event_id, nueva_hora_inicio } = toolArgs;
      console.log(`🔧 Agent tool: reagendar_cita(${event_id} → ${nueva_hora_inicio})`);

      // CRITICAL: Get the existing event BEFORE updating to know the old slot time
      const existingEvent = await getCalendarEventService(event_id, calendarClient, authClient, calendarId);
      const oldStartIso = existingEvent?.start?.dateTime || existingEvent?.start?.date || null;

      const clientName = getClientName(session) || 'Cliente';
      const event = await updateCalendarEventService(
        event_id,
        clientName,
        phone,
        null,
        nueva_hora_inicio,
        session.fecha_boda || null,
        calendarClient,
        authClient,
        calendarId
      );

      if (event) {
        // CRITICAL: Restore the blue event at the OLD slot (it's now available again)
        if (oldStartIso && innoviaCDMXCalendarId) {
          console.log(`🔵 Restaurando slot azul en Innovia CDMX para hora anterior: ${oldStartIso}`);
          await restoreBlueEventService(oldStartIso, calendarClient, authClient, innoviaCDMXCalendarId);
        } else {
          console.warn(`⚠️  No se pudo restaurar slot azul: oldStartIso=${oldStartIso}, innoviaCDMXCalendarId=${innoviaCDMXCalendarId}`);
        }

        // CRITICAL: Delete the blue event at the NEW slot (it's now occupied)
        const storedSlots = session.slots_disponibles || [];
        const appointmentTime = new Date(nueva_hora_inicio).getTime();
        const matchingSlot = storedSlots.find(slot => Math.abs(new Date(slot.start).getTime() - appointmentTime) < 60000);
        if (matchingSlot && matchingSlot.eventId) {
          console.log(`🗑️  Eliminando slot azul del nuevo horario en Innovia CDMX (ID: ${matchingSlot.eventId})`);
          await deleteCalendarEventService(matchingSlot.eventId, calendarClient, authClient, innoviaCDMXCalendarId);
        } else {
          console.warn(`⚠️  No se encontró slot azul coincidente para eliminar en hora: ${nueva_hora_inicio}`);
        }

        return {
          exito: true,
          event_id: event.id,
          mensaje: 'Cita reagendada exitosamente.'
        };
      }
      return { exito: false, mensaje: 'No se pudo reagendar la cita.' };
    }

    return { error: `Herramienta desconocida: ${toolName}` };
  } catch (err) {
    console.error(`❌ Error en tool ${toolName}:`, err.message);
    return { error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Main agent function
// ---------------------------------------------------------------------------
/**
 * Run the conversational agent for an incoming message.
 *
 * @param {string}  phone          - Cleaned phone number
 * @param {Object}  session        - Current session object
 * @param {string}  message        - Raw incoming message (may be a button ID like "slot_0")
 * @param {Object}  calendarDeps   - { calendarClient, authClient, calendarId, innoviaCDMXCalendarId }
 * @param {boolean} isButtonClick  - True when message comes from an interactive button
 * @param {string}  buttonTitle    - Human-readable button label (if isButtonClick)
 * @returns {Promise<{ reply: string, sessionUpdates: Object }>}
 */
async function runAgent(phone, session, message, calendarDeps, isButtonClick = false, buttonTitle = null) {
  const client = getOpenAIClient();

  // Resolve button clicks to human-readable text so the LLM understands them
  let resolvedMessage = message;
  if (isButtonClick) {
    if (message.startsWith('slot_')) {
      const idx = parseInt(message.replace('slot_', ''), 10);
      const slots = session.slots_disponibles || [];
      if (slots[idx]) {
        const slot = slots[idx];
        resolvedMessage = `Selecciono el horario ${slot.time} (inicio: ${slot.start})`;
      } else {
        resolvedMessage = buttonTitle || message;
      }
    } else {
      resolvedMessage = buttonTitle || message;
    }
  }

  // Build conversation messages (last 20 exchanges for context)
  const history = (session.historial || [])
    .slice(-20)
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

  // Replace the last user message with the resolved version (button click → readable text)
  if (history.length > 0 && history[history.length - 1].role === 'user') {
    history[history.length - 1].content = resolvedMessage;
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(session, phone) },
    ...history
  ];

  const sessionUpdates = {};
  const MAX_ITERATIONS = 5;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    console.log(`🤖 Agent loop iteration ${i + 1}`);

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 600
    });

    const choice = response.choices[0];

    // ---- Tool call round -------------------------------------------------
    if (choice.finish_reason === 'tool_calls') {
      messages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        console.log(`🔧 Tool call: ${toolName}`, toolArgs);
        const result = await executeTool(toolName, toolArgs, calendarDeps, session, phone);
        console.log(`✅ Tool result:`, result);

        // Propagate side-effects to sessionUpdates
        if (toolName === 'buscar_slots_disponibles' && result.slots_disponibles) {
          sessionUpdates.slots_disponibles = result.slots_disponibles;
          sessionUpdates.fecha_cita_solicitada = toolArgs.fecha;
        }
        if (toolName === 'confirmar_cita' && result.exito) {
          sessionUpdates.calendar_event_id = result.event_id;
          sessionUpdates.etapa = 'cita_agendada';
          sessionUpdates.slots_disponibles = null;
          sessionUpdates.fecha_cita = toolArgs.hora_inicio.split('T')[0];
          // Also persist name if provided
          if (toolArgs.nombre_cliente) {
            sessionUpdates.nombre_cliente = toolArgs.nombre_cliente;
            sessionUpdates.nombre_novia = toolArgs.nombre_cliente;
          }
          if (toolArgs.fecha_boda) {
            sessionUpdates.fecha_boda = toolArgs.fecha_boda;
          }
        }
        if (toolName === 'cancelar_cita' && result.exito) {
          sessionUpdates.calendar_event_id = null;
          sessionUpdates.etapa = 'interesada';
          sessionUpdates.fecha_cita = null;
        }
        if (toolName === 'reagendar_cita' && result.exito) {
          sessionUpdates.calendar_event_id = result.event_id;
          sessionUpdates.fecha_cita = toolArgs.nueva_hora_inicio.split('T')[0];
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      }

      continue; // Let LLM generate the final response
    }

    // ---- Final response --------------------------------------------------
    const reply = choice.message.content || '';
    console.log(`🤖 Agent reply (${reply.length} chars)`);
    return { reply, sessionUpdates };
  }

  // Safety fallback
  return {
    reply: 'Lo siento, ocurrió un problema procesando tu mensaje. ¿Puedes intentarlo de nuevo?',
    sessionUpdates
  };
}

module.exports = { runAgent };
