/**
 * Genera e restituisce la stringa HTML completa per la pagina iniziale di benvenuto.
 * Questa versione migliorata usa i componenti CSS esistenti per creare una pagina
 * più accogliente e visivamente d'impatto.
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
        <!-- Policy di Sicurezza: fondamentale per la protezione da attacchi. -->
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self';" />
      </head>
      <body>
        <div class="container">

          <!-- MIGLIORAMENTO: Uso di una struttura "hero" per un maggiore impatto visivo. -->
          <header class="album-header text-center" style="grid-template-columns: 1fr; padding-block: var(--space-2xl);">
            
            <!-- Icona SVG che funge da logo/grafica principale, usando i colori del tema. -->
            <div class="album-cover-wrapper" style="max-width: 150px; margin-inline: auto; animation: float 15s infinite ease-in-out;">
              <svg aria-hidden="true" fill="var(--spotify-green)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-1.29 15.24a.75.75 0 0 1-1.06-1.06 6.25 6.25 0 0 1 8.84-8.84.75.75 0 1 1-1.06 1.06A4.75 4.75 0 0 0 8.71 16.18Zm1.06-2.12a.75.75 0 1 1-1.06-1.06A2.25 2.25 0 0 1 13 10.75a.75.75 0 0 1 0 1.5 3.75 3.75 0 0 0-3.23 2.81Z"/></svg>
            </div>
            
            <div class="album-info">
              <h1>Benvenuto in Matchify</h1>
              <h2 class="text-muted" style="font-size: var(--fs-lg); font-weight: var(--fw-normal);">
                Scopri la compatibilità musicale tra le tue playlist e quelle dei tuoi amici.
              </h2>
            </div>

          </header>

          <main class="text-center mt-4">
            <!-- MIGLIORAMENTO: Pulsante con icona SVG per maggiore chiarezza e stile. -->
            <a href="/login" class="btn btn-primary btn-lg" style="padding: var(--space-md) var(--space-xl);">
              <!-- Icona di Spotify -->
              <svg aria-hidden="true" role="img" height="24" width="24" viewBox="0 0 24 24" fill="currentColor" style="margin-right: var(--space-sm);"><path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm4.889 12.042c-.22.359-.72.469-1.079.249a7.222 7.222 0 0 1-4.329-1.32c-.34-.2-.449-.66-.249-1.009.2-.34.66-.449 1.01-.249a5.711 5.711 0 0 0 3.499 1.06c.35.099.46.59.249 1.219zm1.2-2.73c-.26.429-.86.589-1.289.329a8.974 8.974 0 0 1-5.339-2.22c-.37-.28-.5-.81-.22-1.18.28-.37.81-.5 1.18-.22a7.489 7.489 0 0 0 4.419 1.84c.42.06.61.62.33 1.079l.009.001zm.13-3.111c-.32.539-1.04.739-1.579.419a11.115 11.115 0 0 1-6.521-3.66c-.45-.4-.6-.99-.2-1.44s.99-.6 1.44-.2a9.61 9.61 0 0 0 5.661 3.18c.53.119.78.71.42 1.259l-.001.001z"></path></svg>
              Accedi con Spotify
            </a>
          </main>
          
          <footer class="text-center mt-4">
              <p class="text-muted" style="font-size: var(--fs-sm);">&copy; ${new Date().getFullYear()} Matchify. Creato con amore per la musica.</p>
          </footer>

        </div>
      </body>
    </html>
  `;
};

module.exports = {
  renderStartPage,
};
