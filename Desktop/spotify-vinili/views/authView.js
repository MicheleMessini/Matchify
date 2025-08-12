/**
 * Genera e restituisce la stringa HTML essenziale per la pagina iniziale di benvenuto.
 * Questa versione è stata ridotta al minimo indispensabile per la funzionalità.
 * @returns {string} - L'intera pagina HTML come stringa.
 */
const renderStartPage = () => {
  return `
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="UTF-A">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Benvenuto in Matchify</title>
        <link rel="stylesheet" href="/styles.css">
        <!-- Policy di Sicurezza: fondamentale per la protezione. -->
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self';" />
      </head>
      <body>
        <div class="container" style="display: flex; align-items: center; justify-content: center; min-height: 100vh;">

          <main class="text-center">
          
            <h1>Matchify</h1>
            
            <p class="text-muted" style="margin-bottom: var(--space-lg);">
              Clicca qui sotto per accedere e analizzare le tue playlist.
            </p>

            <a href="/login" class="btn btn-primary">Accedi con Spotify</a>
            
          </main>

        </div>
      </body>
    </html>
  `;
};

module.exports = {
  renderStartPage,
};
