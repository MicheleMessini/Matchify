const { makeSpotifyRequest } = require('../services/spotifyService');
const appCache = require('../utils/cache');
const {
    // Ora usiamo l'oggetto CONFIG per centralizzare le costanti
    CONFIG,
    validatePageNumber,
    validatePlaylistId,
    handleError,
    delay,
    formatDuration
} = require('../utils/helpers');
const { renderPlaylistsPage, renderPlaylistDetailPage } = require('../views/playlistView');

const PLAYLIST_RATE_LIMIT_DELAY = 100;

// =================================================================
// --- Servizi di Dati (Logica di Fetching) ---
// =================================================================

/**
 * Recupera tutte le playlist di un utente, con caching.
 */
const fetchAllUserPlaylists = async (accessToken) => {
    // La chiave di cache include una parte del token per essere specifica dell'utente
    const cacheKey = `user-playlists:${accessToken.slice(-10)}`;
    const cachedPlaylists = appCache.get(cacheKey);
    if (cachedPlaylists) {
        console.log("CACHE HIT: Restituendo le playlist dalla cache.");
        return cachedPlaylists;
    }

    let playlists = [];
    let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=50';
    while (nextUrl) {
        const data = await makeSpotifyRequest(nextUrl, accessToken);
        if (data?.items) {
            playlists.push(...data.items.filter(p => p && p.id));
        }
        nextUrl = data.next;
    }
    
    // Salva il risultato in cache per 10 minuti (600 secondi)
    appCache.set(cacheKey, playlists, 600);
    console.log("CACHE MISS: Playlist recuperate dall'API e salvate in cache.");
    return playlists;
};

/**
 * Recupera tutte le tracce di una singola playlist.
 */
const fetchAllPlaylistTracks = async (playlistId, accessToken) => {
    let tracks = [];
    let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&fields=items(track(duration_ms,name,id,artists,album(id,name,images,total_tracks,artists),uri)),next,total`;

    while (nextUrl) {
        const tracksData = await makeSpotifyRequest(nextUrl, accessToken);
        if (tracksData?.items) {
            tracks.push(...tracksData.items.filter(item => item?.track));
        }
        nextUrl = tracksData.next;
        if (nextUrl) await delay(PLAYLIST_RATE_LIMIT_DELAY);
    }
    return tracks;
};

// =================================================================
// --- Servizi di Elaborazione Dati (Logica di Business) ---
// =================================================================

/**
 * Processa i dati grezzi delle tracce in un formato strutturato e calcola le statistiche.
 * Esegue un unico ciclo sull'array delle tracce per massima efficienza.
 */
const processPlaylistTracks = (allTracks) => {
    let totalDurationMs = 0;
    const albumsInPlaylist = {};
    const artistCounts = {};

    for (const item of allTracks) {
        const { track } = item;
        if (!track) continue;

        totalDurationMs += track.duration_ms || 0;

        // Conteggio artisti
        track.artists?.forEach(artist => {
            if (!artistCounts[artist.id]) {
                artistCounts[artist.id] = { id: artist.id, name: artist.name, trackCount: 0 };
            }
            artistCounts[artist.id].trackCount++;
        });

        // Raggruppamento album
        const { album } = track;
        if (!album?.id) continue;
        if (!albumsInPlaylist[album.id]) {
            albumsInPlaylist[album.id] = {
                id: album.id, name: album.name, image: album.images?.[0]?.url || CONFIG.PLACEHOLDER_IMAGE, artist: album.artists.map(a => a.name).join(', '), totalTracks: album.total_tracks, tracksPresent: 0
            };
        }
        albumsInPlaylist[album.id].tracksPresent++;
    }

    // Calcolo percentuali e ordinamento finale
    const albums = Object.values(albumsInPlaylist);
    albums.forEach(album => album.percentage = album.totalTracks > 0 ? Math.round((album.tracksPresent / album.totalTracks) * 100) : 0);
    
    const sortedAlbums = albums.sort((a, b) => b.percentage - a.percentage || b.tracksPresent - a.tracksPresent || a.name.localeCompare(b.name));
    const sortedArtists = Object.values(artistCounts).sort((a, b) => b.trackCount - a.trackCount);
    
    return {
        stats: {
            totalTracks: allTracks.length,
            durationText: formatDuration(totalDurationMs),
            uniqueAlbumsCount: albums.length,
            uniqueArtistsCount: sortedArtists.length,
        },
        artists: sortedArtists,
        albums: sortedAlbums
    };
};

// =================================================================
// --- Controller (Gestori delle Rotte) ---
// =================================================================

/**
 * Gestore per la pagina principale che elenca le playlist dell'utente.
 */
const getPlaylistsPage = async (req, res) => {
  const accessToken = req.session.accessToken;
  if (!accessToken) return res.redirect('/start');
  
  const page = validatePageNumber(req.query.page);
  
  try {
    const playlists = await fetchAllUserPlaylists(accessToken);
    playlists.sort((a, b) => (b.tracks?.total || 0) - (a.tracks?.total || 0));

    const totalPages = Math.ceil(playlists.length / CONFIG.PLAYLISTS_PER_PAGE);
    const paginatedPlaylists = playlists.slice((page - 1) * CONFIG.PLAYLISTS_PER_PAGE, page * CONFIG.PLAYLISTS_PER_PAGE);

    res.send(renderPlaylistsPage(paginatedPlaylists, page, totalPages));
  } catch (err) {
    if (err.message === 'UNAUTHORIZED') { req.session.destroy(); return res.redirect('/start'); }
    handleError(res, 'Impossibile recuperare le playlist.');
  }
};

/**
 * Gestore per la pagina di dettaglio di una singola playlist.
 */
const getPlaylistDetailPage = async (req, res) => {
  const { id: playlistId } = req.params;
  const accessToken = req.session.accessToken;
  if (!validatePlaylistId(playlistId)) return handleError(res, 'ID playlist non valido', 400);
  if (!accessToken) return res.redirect('/start');

  const view = req.query.view === 'artist' ? 'artist' : 'album';
  const page = validatePageNumber(req.query.page);

  try {
    const cacheKey = `playlist-details:${playlistId}`;
    let processedData = appCache.get(cacheKey);

    if (!processedData) {
        console.log(`CACHE MISS: Elaborando dettagli per playlist ${playlistId}`);
        const [playlistInfo, allTracks] = await Promise.all([
            makeSpotifyRequest(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}`, accessToken),
            fetchAllPlaylistTracks(playlistId, accessToken)
        ]);
        
        processedData = {
            playlistInfo,
            ...processPlaylistTracks(allTracks)
        };
        // Salva i dati già elaborati in cache per 30 minuti
        appCache.set(cacheKey, processedData, 1800);
    } else {
        console.log(`CACHE HIT: Trovati dettagli per playlist ${playlistId} in cache.`);
    }

    const dataForView = view === 'artist' ? processedData.artists : processedData.albums;
    const itemsPerPage = view === 'artist' ? CONFIG.MAX_ARTISTS_DISPLAYED : CONFIG.ALBUMS_PER_PAGE;
    
    const totalPages = Math.ceil(dataForView.length / itemsPerPage);
    const paginatedContent = dataForView.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    const viewData = {
      playlist: processedData.playlistInfo,
      stats: { ...processedData.stats, totalAlbums: processedData.albums.length },
      view,
      page,
      contentData: paginatedContent,
      totalPages
    };
    
    res.send(renderPlaylistDetailPage(viewData));
  } catch (err) {
    console.error(`Errore nel recuperare dettagli per playlist ${playlistId}:`, err.message);
    if (err.message === 'UNAUTHORIZED') { req.session.destroy(); return res.redirect('/start'); }
    handleError(res, "Errore nel recuperare i dettagli della playlist.");
  }
};


module.exports = { 
    getPlaylistsPage, 
    getPlaylistDetailPage,
    // La funzione calculatePlaylistDuration ora è logica interna a questo controller.
    // Se ti serve ancora per una API, va esportata, altrimenti no.
};
