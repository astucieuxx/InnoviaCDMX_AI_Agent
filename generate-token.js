/**
 * Script temporal para regenerar GOOGLE_TOKEN con scope de Sheets + Calendar.
 * Uso: node generate-token.js
 */
const { google } = require('googleapis');
const readline = require('readline');
const fs = require('fs');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/spreadsheets'
];

let credentials = null;
if (process.env.GOOGLE_CREDENTIALS) {
  credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
} else if (fs.existsSync('./credentials.json')) {
  credentials = JSON.parse(fs.readFileSync('./credentials.json', 'utf8'));
} else {
  console.error('❌ No se encontró credentials.json ni GOOGLE_CREDENTIALS');
  process.exit(1);
}

const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});

console.log('\n🔗 Paso 1: Abre este link en tu navegador:\n');
console.log(authUrl);
console.log('\n📋 Paso 2: Autoriza con Google.');
console.log('   La página dará error de conexión — eso es normal.');
console.log('   Copia el valor de "code" de la URL del navegador.\n');
console.log('   Ejemplo: http://localhost/?code=4/0AX4XfWg...  ← copia solo esa parte después de code=\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Pega el código aquí: ', async (code) => {
  rl.close();
  // Limpiar por si pegaron la URL completa
  const clean = code.includes('code=') ? new URL(code).searchParams.get('code') : code.trim();
  try {
    const { tokens } = await oAuth2Client.getToken(clean);
    console.log('\n✅ Token generado. Copia este JSON como GOOGLE_TOKEN en Railway:\n');
    console.log(JSON.stringify(tokens));
    console.log('\n');
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
});
