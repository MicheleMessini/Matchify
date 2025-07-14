// Funzione per escape HTML (contro XSS)
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, ''');
}

// Validazione parametri
function validatePlaylistId(id) {
  return id && typeof id === 'string' && id.length > 0 && !/[<>"]/.test(id);
}

function validateAlbumId(id) {
  return id && typeof id === 'string' && id.length > 0 && !/[<>"]/.test(id);
}

function validatePageNumber(page) {
  const num = parseInt(page);
  return isNaN(num) ? 1 : Math.max(1, num);
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

  res.status(status).send(html);
}


module.exports = {
    escapeHtml,
    validatePlaylistId,
    validateAlbumId,
    validatePageNumber,
    handleError
};
