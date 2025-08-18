/**
 * Genera l'HTML per la pagina iniziale (autenticazione).
 * Utilizza un foglio di stile dedicato (auth.css) e una classe sul body per la centratura.
 */
const renderStartPage = () => {
  return `
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Benvenuto in Matchify</title>
        <!-- Link al foglio di stile dedicato per questa pagina -->
        <link rel="stylesheet" href="/auth.css">
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self';" />
      </head>
      <!-- Applica la classe per attivare lo stile di centratura da auth.css -->
      <body class="auth-page-body">

        <main>
            <h1>Matchify</h1>

            <p class="text-muted" style="font-size: var(--fs-lg); margin: var(--space-md) 0 var(--space-xl) 0; max-width: 45ch;">
                Scopri la compatibilità musicale analizzando le tue playlist.
            </p>

            <a href="/login" class="btn btn-primary" style="padding: var(--space-md) var(--space-xl); font-size: var(--fs-lg);">
                Accedi con Spotify
            </a>
        </main>

      </body>
    </html>
  `;
};

module.exports = {
  renderStartPage,
};
