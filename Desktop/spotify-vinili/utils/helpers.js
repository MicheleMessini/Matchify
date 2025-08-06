// =================================================================
// --- Costanti Globali ---
// =================================================================

// Costanti per la paginazione e la visualizzazione dei dati
const PLAYLISTS_PER_PAGE = 6;
const ALBUMS_PER_PAGE = 12;
const MAX_ARTISTS_DISPLAYED = 50;


// =================================================================
// --- Funzioni di Formattazione e Utilità Generiche ---
// =================================================================

/**
 * Converte i millisecondi in una stringa di durata leggibile (es. "1h 15m" o "5m").
 * @param {number} milliseconds - La durata in millisecondi.
 * @returns {string} - La stringa formattata.
 */
const formatDuration = (milliseconds) => {
  if (isNaN(milliseconds) || milliseconds <= 0) return '0m';

  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60; // Utile se si volesse una maggiore precisione

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`; // Ritorna i secondi solo se la durata è meno di un minuto
};


/**
 * Crea una pausa asincrona. Utile per il rate limiting delle API.
 * @param {number} ms - Il numero di millisecondi da attendere.
 * @returns {Promise<void>} - Una promessa che si risolve dopo il timeout specificato.
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


/**
 * Esegue l'escape di caratteri HTML speciali per prevenire attacchi XSS (Cross-Site Scripting).
 * @param {string} str - La stringa da sanificare.
 * @returns {string} - La stringa sanificata.
 */
function escapeHtml(str) {
  if (str === null || typeof str === 'undefined') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}


// =================================================================
// --- Funzioni di Validazione degli Input ---
// =================================================================

/**
 * Valida un ID di playlist. Deve essere una stringa non vuota, di lunghezza ragionevole e senza caratteri pericolosi.
 * @param {string} id - L'ID da validare.
 * @returns {boolean} - true se l'ID è valido, altrimenti false.
 */
function validatePlaylistId(id) {
  return id && typeof id === 'string' && id.length > 0 && id.length <= 100 && !/[<>"']/.test(id);
}

/**
 * Valida un ID di album. Applica le stesse regole dell'ID playlist.
 * @param {string} id - L'ID da validare.
 * @returns {boolean} - true se l'ID è valido, altrimenti false.
 */
function validateAlbumId(id) {
  return id && typeof id === 'string' && id.length > 0 && id.length <= 100 && !/[<>"']/.test(id);
}

/**
 * Valida un numero di pagina da un parametro query. Restituisce 1 se non valido o non fornito.
 * Limita anche il numero di pagina a un massimo ragionevole per sicurezza.
 * @param {string|number} page - Il numero di pagina dalla richiesta.
 * @returns {number} - Il numero di pagina validato.
 */
function validatePageNumber(page) {
  const num = parseInt(page, 10);
  return isNaN(num) ? 1 : Math.max(1, Math.min(1000, num)); // Min 1, Max 1000
}


// =================================================================
// --- Componenti di UI e Gestione Errori ---
// =================================================================

/**
 * Genera l'HTML per i controlli di paginazione.
 * @param {number} currentPage - La pagina corrente.
 * @param {number} totalPages - Il numero totale di pagine.
 * @param {string} baseUrl - L'URL di base per i link (es. "/?view=album&").
 * @returns {string} - La stringa HTML per la paginazione, o una stringa vuota se non necessaria.
 */
const renderPagination = (currentPage, totalPages, baseUrl) => {
  if (totalPages <= 1) return '';
  
  return `
    <nav aria-label="Page navigation">
      <ul class="pagination justify-content-center">
        <li class="page-item ${currentPage <= 1 ? 'disabled' : ''}">
          <a class="page-link" href="${baseUrl}page=${currentPage - 1}">« Precedente</a>
        </li>
        <li class="page-item active" aria-current="page">
          <span class="page-link">Pagina ${currentPage} di ${totalPages}</span>
        </li>
        <li class="page-item ${currentPage >= totalPages ? 'disabled' : ''}">
          <a class="page-link" href="${baseUrl}page=${currentPage + 1}">Successivo »</a>
        </li>
      </ul>
    </nav>
  `;
};

/**
 * Gestisce la visualizzazione centralizzata degli errori, inviando una pagina HTML standard.
 * @param {object} res - L'oggetto response di Express.
 * @param {string} message - Il messaggio di errore da mostrare all'utente.
 * @param {number} [status=500] - Lo status code HTTP da inviare.
 */
function handleError(res, message, status = 500) {
  const escapedMessage = escapeHtml(message);
  
  // Log dell'errore lato server, specialmente per errori 5xx.
  console.error(`[Error Handler] Status: ${status}, Message: ${message}`);
  
  const html = `
    <!DOCTYPE html>
    <html lang="it">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Errore ${status}</title>
        <link rel="stylesheet" href="/styles.css" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline';" />
      </head>
      <body>
        <div class="container text-center">
          <h2 class="error-title">❌ Errore ${status}</h2>
          <p class="error-message">${escapedMessage}</p>
          <a href="/start" class="btn btn-secondary mt-3">Torna alla Home</a>
        </div>
      </body>
    </html>
  `;
  
  res.status(status).send(html);
}


// Esporta tutte le funzioni e le costanti
module.exports = {
    // Costanti
    PLAYLISTS_PER_PAGE,
    ALBUMS_PER_PAGE,
    MAX_ARTISTS_DISPLAYED,
    // Utilità
    formatDuration,
    delay,
    escapeHtml,
    // Validazione
    validatePlaylistId,
    validateAlbumId,
    validatePageNumber,
    // UI e Gestione Errori
    renderPagination,
    handleError
};
