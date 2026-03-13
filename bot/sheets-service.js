/**
 * Pending Tasks Store (in-memory)
 *
 * Manages escalation tasks entirely within the server — no external services needed.
 * Tasks are stored in a simple in-memory array, visible and manageable via the dashboard.
 */

const pendingTasks = [];
let nextId = 1;

/**
 * Log a pending task when a conversation is escalated to a human agent.
 *
 * @param {Object} task
 * @param {string} task.phone     - Client phone number
 * @param {string} task.name      - Client name (or empty string)
 * @param {string} task.message   - The message that triggered the escalation
 * @param {Array}  task.historial - Session history (last messages for context)
 */
function logPendingTask({ phone, name, message, historial = [] }) {
  const now = new Date();
  const tz = 'America/Mexico_City';

  const contexto = historial
    .slice(-4)
    .map(m => `${m.role === 'user' ? 'Cliente' : 'Bot'}: ${m.content.substring(0, 80)}`)
    .join(' | ');

  const task = {
    id: nextId++,
    fecha: now.toLocaleDateString('es-MX', { timeZone: tz }),
    hora: now.toLocaleTimeString('es-MX', { timeZone: tz, hour: '2-digit', minute: '2-digit' }),
    nombre: name || '',
    telefono: phone,
    ultimoMensaje: message,
    contexto,
    estado: 'Pendiente',
    createdAt: now.toISOString()
  };

  pendingTasks.push(task);

  // Keep only the last 500 tasks to avoid unbounded memory growth
  if (pendingTasks.length > 500) pendingTasks.shift();

  console.log(`📋 Tarea pendiente #${task.id}: ${name || phone} — "${message.substring(0, 50)}"`);
}

/**
 * Get all pending tasks (Estado = Pendiente), newest first.
 */
function getPendingTasks() {
  return pendingTasks
    .filter(t => t.estado !== 'Resuelto')
    .slice()
    .reverse();
}

/**
 * Mark a task as resolved by its id.
 * @param {number} id
 */
function resolvePendingTask(id) {
  const task = pendingTasks.find(t => t.id === id);
  if (!task) throw new Error(`Tarea #${id} no encontrada`);
  task.estado = 'Resuelto';
  task.resolvedAt = new Date().toISOString();
  console.log(`✅ Tarea pendiente #${id} marcada como resuelta`);
}

module.exports = { logPendingTask, getPendingTasks, resolvePendingTask };
