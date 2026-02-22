/**
 * Handlers Index
 * 
 * Exports all intent handlers as a map for easy routing.
 */

const saludoHandler = require('./saludo');
const informacionHandler = require('./informacion');
const catalogoHandler = require('./catalogo');
const preciosHandler = require('./precios');
const ubicacionHandler = require('./ubicacion');
const agendarNuevaHandler = require('./agendar');
const cambiarCitaHandler = require('./cambiar-cita');
const cancelarCitaHandler = require('./cancelar-cita');
const escalacionHandler = require('./escalacion');

const handlers = {
  SALUDO: saludoHandler,
  INFORMACION: informacionHandler,
  CATALOGO: catalogoHandler,
  PRECIOS: preciosHandler,
  UBICACION: ubicacionHandler,
  AGENDAR_NUEVA: agendarNuevaHandler,
  CAMBIAR_CITA: cambiarCitaHandler,
  CANCELAR_CITA: cancelarCitaHandler,
  OTRO: escalacionHandler
};

module.exports = { handlers };
