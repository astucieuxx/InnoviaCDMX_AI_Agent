/**
 * Google Sheets Service - Pending Tasks Logger
 *
 * Appends a row to a Google Spreadsheet every time a task requires
 * human follow-up (escalation / OTRO intent).
 *
 * Required env var:
 *   GOOGLE_SHEETS_PENDING_TASKS_ID  — the spreadsheet ID (from the URL)
 *   GOOGLE_CREDENTIALS              — same service account / OAuth used for Calendar
 *   GOOGLE_TOKEN                    — (only needed for OAuth flow)
 */

const { google } = require('googleapis');
const fs = require('fs');

const SHEET_NAME = 'Tareas Pendientes';
const HEADERS = ['Fecha', 'Hora', 'Nombre', 'Teléfono', 'Último Mensaje', 'Contexto', 'Estado'];

let _sheetsClient = null;
let _authClient = null;

// ─── Auth (reuses same logic as main bot) ────────────────────────────────────

async function getAuth() {
  if (_authClient) return _authClient;

  let credentials = null;

  if (process.env.GOOGLE_CREDENTIALS) {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
  } else if (fs.existsSync('./credentials.json')) {
    credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
  } else {
    const files = fs.readdirSync('.').filter(f => f.startsWith('client_secret_') && f.endsWith('.json'));
    if (files.length > 0) {
      credentials = JSON.parse(fs.readFileSync(files[0], 'utf8'));
    }
  }

  if (!credentials) throw new Error('No se encontraron credenciales de Google para Sheets');

  if (credentials.type === 'service_account') {
    _authClient = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/calendar'
      ]
    });
  } else {
    // OAuth2
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    let token = null;
    if (process.env.GOOGLE_TOKEN) {
      token = JSON.parse(process.env.GOOGLE_TOKEN);
    } else if (fs.existsSync('./token.json')) {
      token = JSON.parse(fs.readFileSync('./token.json', 'utf8'));
    }

    if (!token) throw new Error('No se encontró token de Google para Sheets');
    oAuth2Client.setCredentials(token);
    _authClient = oAuth2Client;
  }

  return _authClient;
}

async function getSheetsClient() {
  if (_sheetsClient) return _sheetsClient;
  const auth = await getAuth();
  _sheetsClient = google.sheets({ version: 'v4', auth });
  return _sheetsClient;
}

// ─── Ensure headers exist ────────────────────────────────────────────────────

async function ensureHeaders(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A1:G1`
  });

  const firstRow = res.data.values?.[0];
  if (!firstRow || firstRow.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] }
    });
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Log a pending task row to Google Sheets.
 *
 * @param {Object} task
 * @param {string} task.phone       - Cleaned phone number (e.g. "525512345678")
 * @param {string} task.name        - Client name (or empty string)
 * @param {string} task.message     - The user's message that triggered escalation
 * @param {Array}  task.historial   - Session history array (last messages for context)
 */
async function logPendingTask({ phone, name, message, historial = [] }) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_PENDING_TASKS_ID;
  if (!spreadsheetId) {
    console.warn('⚠️  GOOGLE_SHEETS_PENDING_TASKS_ID no configurado, omitiendo log de tarea pendiente');
    return;
  }

  try {
    const sheets = await getSheetsClient();
    await ensureHeaders(sheets, spreadsheetId);

    const now = new Date();
    const tz = 'America/Mexico_City';
    const fecha = now.toLocaleDateString('es-MX', { timeZone: tz });
    const hora = now.toLocaleTimeString('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit' });

    // Build a short context summary from the last 4 messages
    const contexto = historial
      .slice(-4)
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content.substring(0, 80)}`)
      .join(' | ');

    const row = [fecha, hora, name || '', phone, message, contexto, 'Pendiente'];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET_NAME}!A:G`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] }
    });

    console.log(`📋 Tarea pendiente registrada en Sheets: ${name || phone} — "${message.substring(0, 50)}"`);
  } catch (error) {
    // Never crash the bot because of a Sheets error
    console.error('❌ Error registrando tarea en Google Sheets:', error.message);
  }
}

/**
 * Fetch all pending tasks from Google Sheets (Estado !== 'Resuelto').
 * Returns an array of task objects with rowIndex for later resolution.
 */
async function getPendingTasks() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_PENDING_TASKS_ID;
  if (!spreadsheetId) return [];

  try {
    const sheets = await getSheetsClient();
    await ensureHeaders(sheets, spreadsheetId);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A:G`
    });

    const rows = res.data.values || [];
    if (rows.length <= 1) return [];

    return rows.slice(1)
      .map((row, index) => ({
        rowIndex: index + 2, // 1-based; row 1 is header
        fecha: row[0] || '',
        hora: row[1] || '',
        nombre: row[2] || '',
        telefono: row[3] || '',
        ultimoMensaje: row[4] || '',
        contexto: row[5] || '',
        estado: row[6] || 'Pendiente'
      }))
      .filter(t => t.estado !== 'Resuelto')
      .reverse(); // newest first
  } catch (error) {
    console.error('❌ Error leyendo tareas pendientes de Sheets:', error.message);
    return [];
  }
}

/**
 * Mark a pending task as resolved by updating its Estado cell.
 * @param {number} rowIndex - 1-based row number in the sheet (as returned by getPendingTasks)
 */
async function resolvePendingTask(rowIndex) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_PENDING_TASKS_ID;
  if (!spreadsheetId) throw new Error('GOOGLE_SHEETS_PENDING_TASKS_ID no configurado');

  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_NAME}!G${rowIndex}`,
    valueInputOption: 'RAW',
    requestBody: { values: [['Resuelto']] }
  });

  console.log(`✅ Tarea pendiente en fila ${rowIndex} marcada como resuelta`);
}

module.exports = { logPendingTask, getPendingTasks, resolvePendingTask };
