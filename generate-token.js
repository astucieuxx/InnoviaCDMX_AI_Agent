/**
 * Script temporal para regenerar GOOGLE_TOKEN con scope de Sheets + Calendar.
 * Uso: node generate-token.js
 */
const { google } = require('googleapis');
const http = require('http');
const url = require('url');
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

// Usamos localhost como redirect
const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3333/callback');

const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'consent'
});

console.log('\n🔗 Abre este link en tu navegador:\n');
console.log(authUrl);
console.log('\n⏳ Esperando callback en http://localhost:3333/callback ...\n');

const server = http.createServer(async (req, res) => {
  const qs = url.parse(req.url, true).query;
  if (!qs.code) { res.end('Sin código'); return; }

  try {
    const { tokens } = await oAuth2Client.getToken(qs.code);
    res.end('<h2>✅ Token generado. Revisa tu terminal.</h2>');
    server.close();

    console.log('\n✅ Nuevo token generado. Copia este JSON como GOOGLE_TOKEN en Railway:\n');
    console.log(JSON.stringify(tokens));
    console.log('\n');
  } catch (e) {
    res.end('Error: ' + e.message);
    console.error('❌', e.message);
  }
});

server.listen(3333);
