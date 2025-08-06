const { escapeHtml } = require("../utils/helpers");

/**
 * Genera e restituisce la stringa HTML completa per la pagina iniziale di benvenuto.
 * Questa funzione non prende parametri; è un template statico.
 * @returns {string} - L'intera pagina HTML come stringa.
 */
const renderStartPage = () => {
  return `
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Matchify - Home</title>
        <!-- Il percorso a styles.css funziona grazie al middleware express.static('public') in server.js -->
        <link rel="stylesheet" href="/styles.css">
        <!-- Policy di Sicurezza per il Contenuto: una buona pratica per mitigare attacchi XSS -->
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline';" />
      </head>
      <body>
        <div class="container">
          <header class="text-center">
            <h1>Matchify</h1>
            <p class="lead">Analizza le statistiche dettagliate delle tue playlist Spotify.</p>
          </header>
          <main class="text-center" style="margin-top: 2rem;">
            <a href="/login" class="btn btn-primary btn-lg">Accedi con Spotify</a>
          </main>
        </div>
      </body>
    </html>
  `;
};

// Esporta la funzione in modo che possa essere importata e utilizzata dal authController.js
module.exports = {
    renderStartPage,
};
