const { makeSpotifyRequest } = require('../services/spotifyService');
const { validateAlbumId, validatePlaylistId, handleError } = require('../utils/helpers');
const { renderAlbumDetailPage } = require('../views/albumView');

/**
 * Gestisce la richiesta per la pagina di dettaglio di un album.
 * Recupera i dati dell'album e dei brani da Spotify e li passa alla vista.
 */
const getAlbumDetails = async (req, res) => {
  const { id: albumId } = req.params;
  const { playlistId } = req.query;
  const accessToken = req.session.accessToken;

  // 1. Validazione e Autenticazione
  if (!validateAlbumId(albumId)) {
    return handleError(res, 'ID album non valido', 400);
  }
  if (!accessToken) {
    return res.redirect('/start');
  }

  try {
    // 2. Recupero Dati Principali (in parallelo)
    const [album, tracksDetails] = await Promise.all([
      makeSpotifyRequest(`https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}`, accessToken),
      // Richiedi i dettagli (come la popolarità) per ogni traccia dell'album
      (async () => {
        const tempAlbum = await makeSpotifyRequest(`https://api.spotify.com/v1/albums/${encodeURIComponent(albumId)}/tracks?limit=50`, accessToken);
        const trackIds = tempAlbum.items.map(track => track.id).filter(Boolean).join(',');
        return trackIds ? makeSpotifyRequest(`https://api.spotify.com/v1/tracks?ids=${trackIds}`, accessToken) : { tracks: [] };
      })()
    ]);

    // 3. Recupero Tracce della Playlist (se applicabile)
    let playlistTrackUris = new Set();
    if (playlistId && validatePlaylistId(playlistId)) {
      let nextUrl = `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks?limit=50&fields=items(track(uri)),next`;
      while (nextUrl) {
        const data = await makeSpotifyRequest(nextUrl, accessToken);
        data.items.forEach(item => {
          if (item.track?.uri) playlistTrackUris.add(item.track.uri);
        });
        nextUrl = data.next;
      }
    }
    
    // 4. Modifica l'URL dell'immagine per usare il proxy locale
    if (album.images && album.images.length > 0) {
      const originalImageUrl = album.images[0].url;
      album.images[0].proxyUrl = `/album/proxy-image?url=${encodeURIComponent(originalImageUrl)}`;
    }
    
    // 5. Elaborazione dei Dati per la Vista
    const viewData = {
      album,
      tracksDetails,
      playlistId,
      playlistTrackUris,
    };
    
    // 6. Renderizzazione della Pagina
    const html = renderAlbumDetailPage(viewData);
    res.send(html);
  } catch (err) {
    // 7. Gestione Errori
    console.error('Error fetching album details:', err.message);
    if (err.message === 'UNAUTHORIZED') {
      req.session.destroy();
      return res.redirect('/start');
    }
    if (err.response?.status === 404) {
      return handleError(res, 'Album non trovato', 404);
    }
    handleError(res, "Errore nel recupero dei dettagli dell'album.");
  }
};

/**
 * Proxy per le immagini - risolve problemi CORS
 * Permette l'estrazione del colore dominante nel browser
 */
const proxyImage = async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).send('URL mancante');
  }

  try {
    // Usa fetch nativo di Node.js 18+ o node-fetch
    let fetch;
    if (global.fetch) {
      fetch = global.fetch;
    } else {
      fetch = (await import('node-fetch')).default;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    // Imposta gli header CORS corretti
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', response.headers.get('content-type'));
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache per 24 ore
    
    // Invia l'immagine
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (err) {
    console.error('Error proxying image:', err.message);
    res.status(500).send('Errore nel recupero dell\'immagine');
  }
};

module.exports = {
  getAlbumDetails,
  proxyImage,
};
