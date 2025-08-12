/**
 * Genera e restituisce la stringa HTML completa per la pagina iniziale di benvenuto (autenticazione).
 * VERSIONE DEFINITIVA CORRETTA: Contiene la parentesi di chiusura mancante.
 * @returns {string} - L'intera pagina HTML come stringa.
 */
const renderStartPage = () => {
  return `
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Benvenuto in Matchify</title>
        <link rel="stylesheet" href="/styles.css">
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self';" />
      </head>
      <body>
        <!-- Contenitore flessibile per centrare perfettamente il contenuto -->
        <div class="container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; text-align: center;">

            <main>
                <!-- Usiamo l'h1 con lo stile a gradiente che hai già definito -->
                <h1>Matchify</h1>

                <!-- Paragrafo descrittivo con una spaziatura controllata tramite margin -->
                <p class="text-muted" style="font-size: var(--fs-lg); margin: var(--space-md) 0 var(--space-xl) 0; max-width: 45ch;">
                    Scopri la compatibilità musicale analizzando le tue playlist.
                </p>

                <!-- Pulsante principale con dimensioni maggiori per una chiara Call to Action -->
                <a href="/login" class="btn btn-primary" style="padding: var(--space-md) var(--space-xl); font-size: var(--fs-lg);">
                    Accedi con Spotify
                </a>
            </main>

        </div>
      </body>
    </html>
  `;
}; 

module.exports = {
  renderStartPage,
};
