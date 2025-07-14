// Funzione per escape HTML (contro XSS) - VERSIONE MIGLIORATA
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')      // Converte & in &amp;
    .replace(/</g, '&lt;')       // Converte < in &lt;
    .replace(/>/g, '&gt;')       // Converte > in &gt;
    .replace(/"/g, '&quot;')     // Converte " in &quot;
    .replace(/'/g, '&#x27;');    // Converte ' in &#x27;
}

// Validazione parametri con lunghezza massima
function validatePlaylistId(id) {
  return id && 
         typeof id === 'string' && 
         id.length > 0 && 
         id.length <= 100 && 
         !/[<>"'&]/.test(id);
}

function validateAlbumId(id) {
  return id && 
         typeof id === 'string' && 
         id.length > 0 && 
         id.length <= 100 && 
         !/[<>"'&]/.test(id);
}

function validatePageNumber(page) {
  const num = parseInt(page);
  return isNaN(num) ? 1 : Math.max(1, Math.min(1000, num)); // Max 1000 pagine
}

// Gestione centralizzata degli errori con risposta HTML
function handleError(res, message, status = 500) {
  const escapedMessage = escapeHtml(message);
  const html = `
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Errore</title>
        <link rel="stylesheet" href="/styles.css" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline';" />
      </head>
      <body>
        <div class="container">
          <h2>❌ Errore</h2>
          <p>${escapedMessage}</p>
          <a href="/start" class="btn btn-secondary">Torna alla home</a>
        </div>
      </body>
    </html>
  `;
  
  // Log semplice per debugging (opzionale)
  if (status >= 500) {
    console.error(`[${new Date().toISOString()}] Server Error: ${message}`);
  }
  
  res.status(status).send(html);
}

module.exports = {
    escapeHtml,
    validatePlaylistId,
    validateAlbumId,
    validatePageNumber,
    handleError
};
