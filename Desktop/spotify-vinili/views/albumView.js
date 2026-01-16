const { escapeHtml, formatDuration } = require('../utils/helpers');

/**
 * Genera l'HTML per la pagina di dettaglio di un album in stile Spotify.
 */
const renderAlbumDetailPage = (viewData) => {
  const { album, playlistTrackUris, playlistId } = viewData;
  const totalDurationText = formatDuration(album.tracks.items.reduce((total, track) => total + (track.duration_ms || 0), 0));
  const tracksInPlaylistCount = album.tracks.items.filter(track => playlistTrackUris.has(track.uri)).length;
  
  const renderTrack = (track) => {
    const isInPlaylist = playlistTrackUris.has(track.uri);
    const duration = formatDuration(track.duration_ms || 0);
    
    return `
      <li class="track-item ${isInPlaylist ? 'playing' : ''}">
        <span class="track-number">${track.track_number}</span>
        <div class="track-info">
          <div class="track-name">${escapeHtml(track.name)}</div>
          <div class="track-artists">
            ${escapeHtml(track.artists.map(a => a.name).join(', '))}
          </div>
        </div>
        <div class="track-album">
          ${escapeHtml(album.name)}
        </div>
        <div class="track-duration">
          ${isInPlaylist ? `<span title="Presente nella playlist">✓</span>` : ''}
          ${duration}
        </div>
      </li>
    `;
  };
  
  return `
    <!DOCTYPE html>
    <html lang="it">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(album.name)} - Spotify</title>
      <link rel="stylesheet" href="/album.css">
      <meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self'; img-src 'self' data: https:;">
    </head>
    <body>
      <div class="container">
        
        <header class="album-header" id="albumHeader">
          <img src="${escapeHtml(album.images?.[0]?.proxyUrl || album.images?.[0]?.url || '/placeholder.png')}" 
               alt="${escapeHtml(album.name)}"
               class="album-cover" 
               crossorigin="anonymous"
               onerror="this.src='/placeholder.png'">
          <div class="album-info">
            <p class="album-type">Album</p>
            <h1>${escapeHtml(album.name)}</h1>
            <p class="text-muted">
              ${album.artists.map(a => escapeHtml(a.name)).join(', ')}
            </p>
            <p>
              ${new Date(album.release_date).getFullYear()} • 
              ${album.total_tracks} bran${album.total_tracks === 1 ? 'o' : 'i'}, 
              ${totalDurationText}
            </p>
            ${playlistId ? `<p class="text-primary" style="margin-top: 0.5rem;">${tracksInPlaylistCount} di ${album.total_tracks} brani nella playlist</p>` : ''}
          </div>
        </header>
        
        <main>
          <div class="track-header">
            <div>#</div>
            <div>Titolo</div>
            <div>Album</div>
            <div style="text-align: right;">⏱</div>
          </div>
          <ol class="tracklist">
            ${album.tracks.items.map(renderTrack).join('')}
          </ol>
        </main>
        
        <footer class="text-center">
          <a href="javascript:history.back()" class="btn btn-secondary">&larr; Torna Indietro</a>
        </footer>
        
      </div>
      
      <script>
        // Estrae il colore dominante dall'immagine dell'album
        function extractDominantColor() {
          const img = document.querySelector('.album-cover');
          const header = document.getElementById('albumHeader');
          
          // Crea un canvas temporaneo
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          img.addEventListener('load', function() {
            // Ridimensiona per performance
            canvas.width = 100;
            canvas.height = 100;
            
            ctx.drawImage(img, 0, 0, 100, 100);
            
            try {
              const imageData = ctx.getImageData(0, 0, 100, 100);
              const data = imageData.data;
              
              // Mappa per contare i colori
              const colorCount = {};
              
              // Campiona ogni 4 pixel per performance
              for (let i = 0; i < data.length; i += 16) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];
                
                // Ignora pixel trasparenti o troppo chiari/scuri
                if (a < 125 || (r > 250 && g > 250 && b > 250) || (r < 10 && g < 10 && b < 10)) {
                  continue;
                }
                
                // Arrotonda i colori per raggruppare tonalità simili
                const roundedR = Math.round(r / 10) * 10;
                const roundedG = Math.round(g / 10) * 10;
                const roundedB = Math.round(b / 10) * 10;
                
                const key = `${roundedR},${roundedG},${roundedB}`;
                colorCount[key] = (colorCount[key] || 0) + 1;
              }
              
              // Trova il colore più frequente
              let maxCount = 0;
              let dominantColor = '93, 58, 74'; // Colore di fallback
              
              for (const color in colorCount) {
                if (colorCount[color] > maxCount) {
                  maxCount = colorCount[color];
                  dominantColor = color;
                }
              }
              
              // Applica il gradiente con il colore dominante
              header.style.background = `linear-gradient(180deg, rgb(${dominantColor}) 0%, #191414 100%)`;
              
            } catch (e) {
              // Se c'è un errore CORS, usa il colore di fallback
              console.log('Impossibile estrarre il colore (CORS), uso il colore di fallback');
            }
          });
          
          // Se l'immagine è già caricata
          if (img.complete) {
            img.dispatchEvent(new Event('load'));
          }
        }
        
        // Esegui l'estrazione del colore
        extractDominantColor();
      </script>
    </body>
    </html>
  `;
};

module.exports = {
  renderAlbumDetailPage,
};
