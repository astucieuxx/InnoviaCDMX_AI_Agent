/**
 * Test Script for Bot Conversation
 * 
 * Simulates conversations without WhatsApp to test OpenAI responses.
 * Tests 5 scenarios: info general, precios, catálogo, agendar cita, ubicación.
 */

require('dotenv').config();
const sessions = require('./sessions');
const { getAIResponse, extractConversationData } = require('./openai-client');

// Test phone number (fake)
const TEST_PHONE = '5215521920710';

/**
 * Simulate a conversation with multiple messages
 */
async function simulateConversation(scenarioName, messages) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 ESCENARIO: ${scenarioName}`);
  console.log('='.repeat(60));
  
  // Clear any existing session for test phone
  sessions.clearSession(TEST_PHONE);
  
  // Get or create session
  const session = sessions.getSession(TEST_PHONE);
  
  for (let i = 0; i < messages.length; i++) {
    const userMessage = messages[i];
    
    console.log(`\n[Usuario ${i + 1}]: ${userMessage}`);
    console.log('-'.repeat(60));
    
    try {
      // Add user message to history
      sessions.addToHistory(TEST_PHONE, 'user', userMessage);
      
      // Get AI response
      const aiResponse = await getAIResponse(session, userMessage);
      
      // Add assistant response to history
      sessions.addToHistory(TEST_PHONE, 'assistant', aiResponse);
      
      // Extract data from conversation
      const extractedData = await extractConversationData(session);
      
      // Update session with extracted data
      const updates = {};
      if (extractedData.nombre_novia && extractedData.nombre_novia !== session.nombre_novia) {
        updates.nombre_novia = extractedData.nombre_novia;
      }
      if (extractedData.fecha_boda && extractedData.fecha_boda !== session.fecha_boda) {
        updates.fecha_boda = extractedData.fecha_boda;
      }
      if (extractedData.nombre_novia && extractedData.fecha_boda && session.etapa === 'primer_contacto') {
        updates.etapa = 'interesada';
      }
      
      if (Object.keys(updates).length > 0) {
        sessions.updateSession(TEST_PHONE, updates);
      }
      
      // Print response
      console.log(`[Bot]: ${aiResponse}`);
      
      // Print extracted data if any
      if (extractedData.nombre_novia || extractedData.fecha_boda) {
        console.log(`\n📊 Datos extraídos:`, extractedData);
      }
      
      // Print session state
      const updatedSession = sessions.getSession(TEST_PHONE);
      console.log(`\n📝 Estado de sesión:`, {
        etapa: updatedSession.etapa,
        nombre_novia: updatedSession.nombre_novia,
        fecha_boda: updatedSession.fecha_boda,
        mensajes_en_historial: updatedSession.historial.length
      });
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      console.error(error.stack);
    }
    
    // Small delay between messages
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n✅ Escenario "${scenarioName}" completado\n`);
}

/**
 * Run all test scenarios
 */
async function runTests() {
  console.log('\n🤖 INICIANDO PRUEBAS DEL BOT\n');
  console.log('⚠️  Asegúrate de tener OPENAI_API_KEY configurado en .env\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ ERROR: OPENAI_API_KEY no está configurado en .env');
    console.error('   Agrega: OPENAI_API_KEY=sk-tu-api-key-aqui');
    process.exit(1);
  }
  
  // Test 1: Info General
  await simulateConversation('INFO GENERAL', [
    'Hola, quiero información sobre sus vestidos'
  ]);
  
  // Test 2: Precios
  await simulateConversation('PRECIOS', [
    'Hola',
    '¿Cuánto cuestan los vestidos?'
  ]);
  
  // Test 3: Catálogo
  await simulateConversation('CATÁLOGO', [
    'Hola',
    '¿Tienen catálogo?'
  ]);
  
  // Test 4: Agendar Cita
  await simulateConversation('AGENDAR CITA', [
    'Hola',
    'Me llamo María González',
    'Mi boda es el 15 de junio de 2025',
    'Quiero agendar una cita'
  ]);
  
  // Test 5: Ubicación
  await simulateConversation('UBICACIÓN', [
    'Hola',
    '¿Dónde están ubicados?'
  ]);
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ TODAS LAS PRUEBAS COMPLETADAS');
  console.log('='.repeat(60) + '\n');
  
  // Cleanup
  sessions.clearSession(TEST_PHONE);
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Error ejecutando pruebas:', error);
  process.exit(1);
});
