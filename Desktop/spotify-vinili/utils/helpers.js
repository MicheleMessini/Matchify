/**
 * utils/helpers.js
 * 
 * Questo file contiene una collezione di funzioni di utilità riutilizzabili e costanti globali
 * per l'intera applicazione, promuovendo un codice pulito e manutenibile.
 */

// =================================================================
// --- Configurazione e Costanti Globali ---
// =================================================================

const CONFIG = {
  PLACEHOLDER_IMAGE: '/placeholder.png',
  DEFAULT_OWNER: 'Sconosciuto',
  PLAYLISTS_PER_PAGE: 6,
  ALBUMS_PER_PAGE: 12,
  MAX_ARTISTS_DISPLAYED: 50,
  ITEMS_PER_PAGE: 20 // Valore aggiunto dal nuovo codice di playlistView
};


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
// --- Funzioni di Validazione degli Input (opzionali se non usate) ---
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

const renderPagination = (currentPage, totalPages, baseUrl) => {
  if (totalPages <= 1) return '';
  
  const prevDisabled = currentPage <= 1 ? 'disabled' : '';
  const nextDisabled = currentPage >= totalPages ? 'disabled' : '';
  
  const prevLink = !prevDisabled ? `${baseUrl}page=${currentPage - 1}` : '#';
  const nextLink = !nextDisabled ? `${baseUrl}page=${currentPage + 1}` : '#';
  
  return `
      <a href="${prevLink}" class="btn btn-secondary ${prevDisabled}">&larr; Precedente</a>
      <span class="page-info">Pagina ${currentPage} di ${totalPages}</span>
      <a href="${nextLink}" class="btn btn-secondary ${nextDisabled}">Successiva &rarr;</a>
  `;
};

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
        <!-- Usa lo stile della pagina di login per coerenza visiva -->
        <link rel="stylesheet" href="/auth.css" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline';" />
      </head>
      <!-- Usa la classe di centratura della pagina di login -->
      <body class="auth-page-body">
        <main>
          <h1 style="color: #f15e6c;">Oops! Errore ${status}</h1>
          <p class="text-muted" style="margin-top: 1rem;">${escapedMessage}</p>
          <a href="/" class="btn btn-primary" style="margin-top: 2rem;">Torna alla Home</a>
        </main>
      </body>
    </html>
  `;
  
  res.status(status).send(html);
}


// =================================================================
// --- Esportazioni del Modulo ---
// =================================================================

module.exports = {
    // Oggetto di configurazione centralizzato
    CONFIG,
    
    // Funzioni di utilità
    formatDuration,
    delay,
    escapeHtml,
    
    // Funzioni di validazione
    validatePlaylistId,
    validateAlbumId,
    validatePageNumber,
    
    // Funzioni di UI
    renderPagination,
    handleError
};
