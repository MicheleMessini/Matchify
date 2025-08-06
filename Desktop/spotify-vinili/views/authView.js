/**
 * Genera e restituisce l'HTML per la pagina iniziale di benvenuto.
 * @returns {string} - La stringa HTML completa per la pagina.
 */
const renderStartPage = () => {
  return `
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Matchify - Home</title>
        <link rel="stylesheet" href="/styles.css">
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline';" />
      </head>
      <body>
        <div class="container">
          <h1>Matchify</h1>
          <p class="text-center">Analizza le statistiche delle tue playlist Spotify.</p>
          <div style="text-align:center; margin-top: 2rem;">
            <a href="/login" class="btn btn-primary">Accedi con Spotify</a>
          </div>
        </div>
      </body>
    </html>
  `;
};

module.exports = {
    renderStartPage,
};```

### Come Utilizzare il Router
Infine, assicurati di montare questo router nel tuo `server.js`, tipicamente sul percorso radice (`/`).

```javascript
// in server.js
const authRoutes = require('./routes/auth');

// ...

app.use('/', authRoutes); // Le rotte /start, /login, /callback saranno gestite qui.
