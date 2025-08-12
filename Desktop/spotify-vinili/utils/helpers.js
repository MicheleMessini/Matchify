// =================================================================
// --- Costanti Globali ---
// =================================================================

const PLAYLISTS_PER_PAGE = 6;
const ALBUMS_PER_PAGE = 12;
const MAX_ARTISTS_DISPLAYED = 50;


// =================================================================
// --- Funzioni di Formattazione e Utilità Generiche ---
// =================================================================

const formatDuration = (milliseconds) => {
  if (isNaN(milliseconds) || milliseconds <= 0) return '0m';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

function validatePlaylistId(id) {
  return id && typeof id === 'string' && id.length > 0 && id.length <= 100 && !/[<>"']/.test(id);
}

function validateAlbumId(id) {
  return id && typeof id === 'string' && id.length > 0 && id.length <= 100 && !/[<>"']/.test(id);
}

function validatePageNumber(page) {
  const num = parseInt(page, 10);
  return isNaN(num) ? 1 : Math.max(1, Math.min(1000, num));
}


// =================================================================
// --- Componenti di UI e Gestione Errori ---
// =================================================================

/**
 * **MODIFICATA**: Genera l'HTML per la paginazione a bottoni, più moderna e intuitiva.
 * Utilizza le classi CSS personalizzate `btn`, `disabled`, `page-info`.
 */
const renderPagination = (currentPage, totalPages, baseUrl) => {
  // Non mostrare nulla se c'è solo una pagina
  if (totalPages <= 1) {
    return '';
  }

  const prevPage = currentPage - 1;
  const nextPage = currentPage + 1;

  // Aggiunge la classe 'disabled' se i bottoni non devono essere cliccabili
  const prevDisabled = currentPage <= 1 ? 'disabled' : '';
  const nextDisabled = currentPage >= totalPages ? 'disabled' : '';

  // Imposta l'URL del link, o '#' se il bottone è disabilitato
  const prevLink = !prevDisabled ? `${baseUrl}page=${prevPage}` : '#';
  const nextLink = !nextDisabled ? `${baseUrl}page=${nextPage}` : '#';

  // Restituisce la nuova struttura a bottoni
  return `
      <a href="${prevLink}" class="btn btn-secondary ${prevDisabled}">&larr; Precedente</a>
      <span class="page-info">Pagina ${currentPage} di ${totalPages}</span>
      <a href="${nextLink}" class="btn btn-secondary ${nextDisabled}">Successiva &rarr;</a>
  `;
};

/**
 * Gestisce la visualizzazione centralizzata degli errori. (Nessuna modifica necessaria qui)
 */
function handleError(res, message, status = 500) {
  const escapedMessage = escapeHtml(message);
  
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
        <div class="container text-center" style="padding-top: var(--space-2xl);">
          <h1 class="error-title">Oops! Qualcosa è andato storto.</h1>
          <p class="error-message text-muted">${escapedMessage}</p>
          <a href="/" class="btn btn-primary mt-3">Torna alla Home</a>
        </div>
      </body>
    </html>
  `;
  
  res.status(status).send(html);
}


// Esporta tutte le funzioni e le costanti
module.exports = {
    PLAYLISTS_PER_PAGE,
    ALBUMS_PER_PAGE,
    MAX_ARTISTS_DISPLAYED,
    formatDuration,
    delay,
    escapeHtml,
    validatePlaylistId,
    validateAlbumId,
    validatePageNumber,
    renderPagination,
    handleError
};
