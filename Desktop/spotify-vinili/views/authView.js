/**
 * Genera e restituisce la stringa HTML completa per la pagina iniziale di benvenuto (autenticazione).
 * VERSIONE DEFINITIVA CON CENTRATURA CORRETTA:
 * Applica gli stili di centratura direttamente al BODY per evitare conflitti con la classe .container.
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
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline';" />

        <!-- Stile specifico per questa pagina che forza la centratura di tutto il contenuto -->
        <style>
          body {
            display: flex;
            align-items: center;      /* Allineamento verticale */
            justify-content: center;  /* Allineamento orizzontale */
            min-height: 100vh;
            padding: var(--space-md); /* Aggiunge un po' di spazio dai bordi */
          }
        </style>
      </head>
      <body class="text-center">

        <!-- Rimosso il .container. Ora il layout è gestito dal body. -->
        <main>
            <h1>Matchify</h1>

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
