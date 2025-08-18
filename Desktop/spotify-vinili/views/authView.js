const renderStartPage = () => {
  return `
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Benvenuto in Matchify</title>
        <link rel="stylesheet" href="/auth.css">
      </head>
      <body>
        <main>
            <h1>Matchify</h1>
            <p class="text-muted" style="margin: 1rem 0 2rem 0;">Scopri la compatibilità musicale.</p>
            <a href="/login" class="btn">Accedi con Spotify</a>
        </main>
      </body>
    </html>
  `;
};
module.exports = { renderStartPage };
