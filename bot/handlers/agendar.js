/**
 * Agendar Handler — Appointment Scheduling Flow
 *
 * Explicit state machine (stored in session.appt_step):
 *
 *   null           → entry point: checks what info is missing and routes accordingly
 *   'NAME'         → waiting for client's full name
 *   'WEDDING_DATE' → waiting for wedding date (user can decline)
 *   'APPT_DATE'    → waiting for desired appointment date
 *
 * After the user picks an appointment date, this handler fetches available slots
 * and shows a numbered list. Slot SELECTION and CONFIRMATION are handled in
 * whatsapp-calendar-bot.js (STEP 2 / confirmar_nueva_cita button), keeping this
 * handler focused on data collection.
 *
 * Backward-compat: legacy boolean flags (pending_nombre, pending_fecha_boda,
 * pending_agendar_fecha) are set alongside appt_step so that whatsapp-calendar-bot.js
 * keeps working without changes to its reads.
 */

const OpenAI = require('openai');
const { getAvailableSlots, isDayOpen } = require('../calendar-service');
const { getBusinessName, getBusinessHours } = require('../../config');
const { analyzeContextualResponse } = require('../utils/context-analyzer');

// ─── OpenAI (lazy init) ───────────────────────────────────────────────────────

let openai = null;
function getOpenAIClient() {
  if (!openai) {
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no configurado');
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

// ─── Step constants ───────────────────────────────────────────────────────────

const STEP = {
  NAME:         'NAME',
  WEDDING_DATE: 'WEDDING_DATE',
  APPT_DATE:    'APPT_DATE',
};

// ─── Small utilities ──────────────────────────────────────────────────────────

const getClientName      = (s) => s.nombre_cliente || s.nombre_novia || null;
const getClientFirstName = (s) => { const n = getClientName(s); return n ? n.split(' ')[0] : null; };

function formatDDMMYYYY(date) {
  if (!date) return date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  }
  const obj = new Date(date);
  if (!isNaN(obj.getTime())) {
    return `${String(obj.getDate()).padStart(2,'0')}/${String(obj.getMonth()+1).padStart(2,'0')}/${obj.getFullYear()}`;
  }
  return date;
}

/**
 * Derive current step from legacy boolean flags so old sessions work correctly.
 */
function deriveStepFromFlags(session) {
  if (session.pending_agendar_fecha) return STEP.APPT_DATE;
  if (session.pending_nombre)        return STEP.NAME;
  if (session.pending_fecha_boda)    return STEP.WEDDING_DATE;
  return null;
}

// ─── Canned responses ─────────────────────────────────────────────────────────

function askForName() {
  return {
    reply: `¡Me encantaría ayudarte a agendar! 👰‍♀️ Primero necesito tu nombre completo (nombre y apellido) para personalizar tu experiencia.\n\n¿Me lo compartes?`,
    sessionUpdates: { appt_step: STEP.NAME, pending_nombre: true },
  };
}

function askForWeddingDate(session) {
  const first = getClientFirstName(session);
  return {
    reply: `¡Perfecto${first ? ` ${first}` : ''}! ✨ Para ayudarte mejor, ¿me compartes la fecha completa de tu boda? Incluye día, mes y año (por ejemplo: "10 de julio 2026"). Si aún no la tienes definida, no hay problema, solo dímelo 💫`,
    sessionUpdates: { appt_step: STEP.WEDDING_DATE, pending_fecha_boda: true },
  };
}

function askForApptDate(horarios) {
  return {
    reply: `¡Con gusto! Nos encantará recibirte 💕\n\n¿Qué día te gustaría visitarnos? Por ejemplo: "el martes 24 de febrero" o "el 4 de marzo".\n\nEstamos abiertos:\n• Martes a sábado: ${horarios.martes_sabado || 'N/A'}\n• Domingos: ${horarios.domingos || 'N/A'}\n• Lunes: ${horarios.lunes || 'Cerrado'}`,
    sessionUpdates: { appt_step: STEP.APPT_DATE, pending_agendar_fecha: true },
  };
}

// ─── Step handlers ────────────────────────────────────────────────────────────

async function handleNameStep(session, message) {
  const analysis = await analyzeContextualResponse(message, 'name_collection', session, {});

  if (analysis.action === 'provide_name' || analysis.action === 'provide_first_name') {
    let nombre = analysis.extractedValue;

    // Fallback extraction when LLM didn't extract the value
    if (!nombre) {
      const phraseMatch = message.match(
        /(?:me\s+llamo|soy|mi\s+nombre\s+es)\s+([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)/i
      );
      if (phraseMatch) {
        nombre = phraseMatch[1];
      } else {
        const capWords = message.split(/\s+/).filter(w => /^[A-ZÁÉÍÓÚÑ]/.test(w));
        if (capWords.length) nombre = capWords.slice(0, 2).join(' ');
      }
    }

    if (nombre) {
      const baseUpdates = {
        nombre_cliente: nombre,
        nombre_novia:   nombre, // backward compat
        appt_step:      null,
        pending_nombre: false,
      };

      // Still need wedding date?
      if (!session.fecha_boda && !session.fecha_boda_declinada) {
        const first = nombre.split(' ')[0];
        return {
          reply: `¡Perfecto ${first}! ✨ Para ayudarte mejor, ¿me compartes la fecha completa de tu boda? Incluye día, mes y año (por ejemplo: "10 de julio 2026"). Si aún no la tienes definida, no hay problema 💫`,
          sessionUpdates: { ...baseUpdates, appt_step: STEP.WEDDING_DATE, pending_fecha_boda: true },
        };
      }

      // Already have all profile data — show cita submenu
      const sessionWithName = { ...session, ...baseUpdates };
      const citaMenu = require('./cita-menu');
      const menuResult = await citaMenu.execute(sessionWithName, message);
      return {
        reply: menuResult.reply,
        sessionUpdates: { ...baseUpdates, ...menuResult.sessionUpdates },
        buttons: menuResult.buttons,
      };
    }
  }

  return askForName();
}

async function handleWeddingDateStep(session, message) {
  const analysis = await analyzeContextualResponse(message, 'wedding_date_collection', session, {});

  const clearWeddingStep = { appt_step: null, pending_fecha_boda: false };

  if (analysis.action === 'decline_date') {
    const updates = { ...clearWeddingStep, fecha_boda_declinada: true };
    const sessionUpdated = { ...session, ...updates };
    const citaMenu = require('./cita-menu');
    const menuResult = await citaMenu.execute(sessionUpdated, message);
    return {
      reply: menuResult.reply,
      sessionUpdates: { ...updates, ...menuResult.sessionUpdates },
      buttons: menuResult.buttons,
    };
  }

  if (analysis.action === 'provide_date') {
    const updates = { ...clearWeddingStep };
    if (analysis.date) updates.fecha_boda = analysis.date;
    const sessionUpdated = { ...session, ...updates };
    const citaMenu = require('./cita-menu');
    const menuResult = await citaMenu.execute(sessionUpdated, message);
    return {
      reply: menuResult.reply,
      sessionUpdates: { ...updates, ...menuResult.sessionUpdates },
      buttons: menuResult.buttons,
    };
  }

  // Ambiguous response — ask again
  return askForWeddingDate(session);
}

async function handleApptDateStep(session, message, calendarDeps) {
  const horarios = getBusinessHours();
  const fecha = await extractFechaCitaDeseada(message, session.fecha_boda);

  if (!fecha) {
    return {
      reply: `¿Qué día te gustaría visitarnos? Por ejemplo: "el martes 24" o "el 4 de marzo" 💐`,
      sessionUpdates: { appt_step: STEP.APPT_DATE, pending_agendar_fecha: true },
    };
  }

  // Guard: don't confuse wedding date with appointment date
  if (session.fecha_boda && fecha === session.fecha_boda) {
    return {
      reply: `Entiendo que mencionaste ${formatDDMMYYYY(fecha)}, pero esa es la fecha de tu boda. ¿Qué día te gustaría visitarnos en el showroom? 💐`,
      sessionUpdates: { appt_step: STEP.APPT_DATE, pending_agendar_fecha: true },
    };
  }

  if (!calendarDeps || !calendarDeps.calendarClient) {
    return {
      reply: `Disculpa, no puedo consultar la disponibilidad en este momento. Por favor intenta más tarde 💫`,
      sessionUpdates: {},
    };
  }

  // ── Fetch available slots ──────────────────────────────────────────────────
  try {
    const excludeEventId = session.calendar_event_id || null;
    const rawSlots = await getAvailableSlots(
      fecha,
      calendarDeps.calendarClient,
      calendarDeps.authClient,
      calendarDeps.innoviaCDMXCalendarId || 'primary',
      excludeEventId
    );

    // Day closed or no slots at all
    if (!isDayOpen(fecha) || rawSlots.length === 0) {
      const [year, month, day] = fecha.split('-').map(Number);
      const dow = new Date(year, month - 1, day).getDay();
      const dayNames = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
      const dayName = dayNames[dow];

      return {
        reply: dayName === 'lunes'
          ? `❌ Los lunes estamos cerrados. Elige otro día.\n\nEstamos abiertos:\n• Martes a sábado: ${horarios.martes_sabado || 'N/A'}\n• Domingos: ${horarios.domingos || 'N/A'}`
          : `❌ No hay horarios disponibles para ${formatDDMMYYYY(fecha)}. Por favor elige otra fecha.`,
        sessionUpdates: { appt_step: STEP.APPT_DATE, pending_agendar_fecha: true },
      };
    }

    // Deduplicate (by timestamp) and sort chronologically
    const seen = new Set();
    const available = rawSlots
      .filter(s => s.availableSpots > 0)
      .filter(s => {
        const ts = s.startTimestamp || (s.start ? new Date(s.start).getTime() : 0);
        if (seen.has(ts)) return false;
        seen.add(ts);
        return true;
      })
      .sort((a, b) => {
        const ta = a.startTimestamp ?? new Date(a.start).getTime();
        const tb = b.startTimestamp ?? new Date(b.start).getTime();
        return ta - tb;
      });

    if (available.length === 0) {
      return {
        reply: `❌ No hay horarios disponibles para ${formatDDMMYYYY(fecha)}. Por favor elige otra fecha.`,
        sessionUpdates: { appt_step: STEP.APPT_DATE, pending_agendar_fecha: true },
      };
    }

    // Build numbered list
    let reply = `Horarios disponibles para ${formatDDMMYYYY(fecha)}:\n\n`;
    available.forEach((slot, i) => { reply += `${i + 1}. ${slot.time}\n`; });
    reply += `\nEscribe el número del horario que prefieras.`;

    console.log(`📅 ${available.length} horarios disponibles para ${fecha} (ya ordenados cronológicamente)`);

    // Slot selection is handled by STEP 2 in whatsapp-calendar-bot.js
    return {
      reply,
      sessionUpdates: {
        appt_step:            null, // STEP 2 in main bot takes over
        pending_agendar_fecha: false,
        slots_disponibles:    available,
        fecha_cita_solicitada: fecha,
        periodo_seleccionado: null,
        slots_medio_dia:      null,
        slots_tarde:          null,
      },
    };
  } catch (err) {
    console.error('❌ Error consultando Google Calendar:', err.message);
    return {
      reply: `Disculpa, hubo un error consultando la disponibilidad. ¿Puedes intentar de nuevo? 💫`,
      sessionUpdates: {},
    };
  }
}

/**
 * Entry point: called when there is no active step. Decides where to start.
 */
async function handleEntryPoint(session, message, calendarDeps) {
  // Missing name → collect it first
  if (!getClientName(session)) return askForName();

  // Missing wedding date → collect it (user can skip)
  if (!session.fecha_boda && !session.fecha_boda_declinada) return askForWeddingDate(session);

  // Profile complete — check if message already contains an appointment date
  const fecha = await extractFechaCitaDeseada(message, session.fecha_boda);
  if (fecha) {
    return handleApptDateStep({ ...session, appt_step: STEP.APPT_DATE }, message, calendarDeps);
  }

  // Show cita submenu (new / edit / cancel)
  const citaMenu = require('./cita-menu');
  const menuResult = await citaMenu.execute(session, message);
  return {
    reply: menuResult.reply,
    sessionUpdates: menuResult.sessionUpdates || {},
    buttons: menuResult.buttons,
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Execute the appointment scheduling handler.
 * @param {Object} session       - Session object
 * @param {string} message       - User's message
 * @param {Object} calendarDeps  - { calendarClient, authClient, calendarId, innoviaCDMXCalendarId }
 */
async function execute(session, message, calendarDeps = null) {
  // Submenu button "Agendar Nueva Cita" — profile already collected, jump to date
  if (message === 'quiero agendar' || message === 'cita_nueva') {
    return askForApptDate(getBusinessHours());
  }

  // Determine current step (new field takes priority; fall back to legacy flags)
  const step = session.appt_step || deriveStepFromFlags(session);

  switch (step) {
    case STEP.NAME:         return handleNameStep(session, message);
    case STEP.WEDDING_DATE: return handleWeddingDateStep(session, message);
    case STEP.APPT_DATE:    return handleApptDateStep(session, message, calendarDeps);
    default:                return handleEntryPoint(session, message, calendarDeps);
  }
}

// ─── Date extraction (shared with main bot) ───────────────────────────────────

/**
 * Extract appointment date from free-form text using OpenAI.
 * Returns a YYYY-MM-DD string or null.
 */
async function extractFechaCitaDeseada(message, fechaBoda) {
  try {
    if (!process.env.OPENAI_API_KEY) return null;

    const systemPrompt = `Eres un extractor de fechas para citas de showroom.

Tu tarea es extraer SOLO la fecha que el usuario quiere para VISITAR el showroom (la fecha de la cita, NO la fecha de la boda).

IMPORTANTE:
- La FECHA DE BODA es: ${fechaBoda || 'no mencionada'}
- El año actual es 2026
- NO extraigas la fecha de boda, solo la fecha para visitar el showroom
- Si el usuario dice "el 4 de marzo", extrae "2026-03-04"
- Si el usuario dice "martes 17 de marzo", extrae "2026-03-17" (ignora el día de semana)
- Si no hay fecha de visita mencionada, devuelve null
- SIEMPRE usa el año 2026 cuando el usuario no especifica año

Responde SOLO con una fecha en formato YYYY-MM-DD o la palabra "null".`;

    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: message },
      ],
      max_tokens:  20,
      temperature: 0.1,
    });

    const raw = response.choices[0].message.content.trim();
    if (!raw || raw.toLowerCase() === 'null') return null;

    // Parse and normalise
    const isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      let [, year, month, day] = isoMatch.map(Number);
      year = resolveYear(year, month, day);
      return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    }

    return null;
  } catch (err) {
    console.error('❌ Error extrayendo fecha de cita:', err.message);
    return null;
  }
}

/**
 * If the extracted year is in the past or missing, infer the correct future year.
 */
function resolveYear(year, month, day) {
  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay   = now.getDate();

  if (year >= currentYear) return year;

  // Year is missing or past — pick the nearest future occurrence
  if (month > currentMonth) return currentYear;
  if (month < currentMonth) return currentYear + 1;
  return day >= currentDay ? currentYear : currentYear + 1;
}

module.exports = { execute, extractFechaCitaDeseada };
