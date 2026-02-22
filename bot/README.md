# Bot Intent-Based Architecture

## File Structure

```
bot/
  ├── classifier.js          # Intent classification (8 intents)
  ├── profile-extractor.js    # Silent profile extraction (nombre_novia, fecha_boda)
  ├── handlers/
  │   ├── index.js           # Exports all handlers as a map
  │   ├── saludo.js          # Greeting handler
  │   ├── informacion.js      # General info handler
  │   ├── catalogo.js        # Catalog handler
  │   ├── precios.js         # Pricing handler
  │   ├── ubicacion.js       # Location handler
  │   ├── agendar.js         # Appointment scheduling handler (ONLY place that calls Google Calendar)
  │   ├── confirmacion.js    # Appointment confirmation/rescheduling handler
  │   └── escalacion.js      # Fallback/escalation handler
  └── README.md              # This file
```

## Flow

1. **Profile Extraction** (runs silently on every message)
   - Extracts `nombre_novia` and `fecha_boda` from conversation
   - Updates session silently if new info found
   - Independent of intent routing

2. **Intent Classification**
   - Single OpenAI call with `temperature: 0`
   - Returns one of: `SALUDO | INFORMACION | CATALOGO | PRECIOS | UBICACION | AGENDAR | CONFIRMACION | OTRO`
   - Considers session context (e.g., if cita is agendada and user says "confirmo" → CONFIRMACION)

3. **Handler Execution**
   - Routes to appropriate handler based on intent
   - Each handler returns `{ reply: string, sessionUpdates: object }`
   - Handler updates session and sends reply

## Handler Interface

All handlers export a single async function:

```javascript
async function execute(session, message) {
  // session: { nombre_novia, fecha_boda, etapa, historial, ... }
  // message: string (user's message)
  
  return {
    reply: "Response message",
    sessionUpdates: {
      // Any session fields to update
    }
  };
}
```

## Important Constraints

- All business info must come from `business_config.json` via `config.js`
- Only `agendar.js` calls Google Calendar
- Handlers are self-contained (don't import from other handlers)
- Profile extraction is separate from intent classification
- `fecha_boda` (wedding date) and `fecha_cita` (appointment date) are NEVER extracted together
