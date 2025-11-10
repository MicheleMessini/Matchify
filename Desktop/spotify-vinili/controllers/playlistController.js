const { makeSpotifyRequest } = require('../services/spotifyService');
const appCache = require('../utils/cache');
const {
    CONFIG,
    validatePageNumber,
    validatePlaylistId,
    handleError,
    delay,
    formatDuration
} = require('../utils/helpers');
const { renderPlaylistsPage, renderPlaylistDetailPage } = require('../views/playlistView');

const PLAYLIST_RATE_LIMIT_DELAY = 100;
const ARTIST_FETCH_DELAY = 50; // Delay tra richieste artisti

// =================================================================
// --- Servizi di Dati (Logica di Fetching) ---
// =================================================================

/**
 * Recupera tutte le playlist di un utente, con caching.
 */
const fetchAllUserPlaylists = async (accessToken) => {
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

/**
 * Recupera le informazioni dettagliate degli artisti (incluse le immagini)
 * Gestisce il rate limiting e raggruppa le richieste in batch
 */
const fetchArtistsDetails = async (artistIds, accessToken) => {
    if (!artistIds || artistIds.length === 0) return {};
    
    const uniqueIds = [...new Set(artistIds)];
    const artistDetails = {};
    const BATCH_SIZE = 50; // Spotify permette max 50 artisti per richiesta
    
    // Dividi in batch di 50
    for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
        const batch = uniqueIds.slice(i, i + BATCH_SIZE);
        const ids = batch.join(',');
        
        try {
            const data = await makeSpotifyRequest(
                `https://api.spotify.com/v1/artists?ids=${ids}`,
                accessToken
            );
            
            if (data?.artists) {
                data.artists.forEach(artist => {
                    if (artist && artist.id) {
                        artistDetails[artist.id] = {
                            name: artist.name,
                            image: artist.images?.[0]?.url || CONFIG.PLACEHOLDER_IMAGE,
                            genres: artist.genres || []
                        };
                    }
                });
            }
            
            // Delay tra batch per rispettare rate limit
            if (i + BATCH_SIZE < uniqueIds.length) {
                await delay(ARTIST_FETCH_DELAY);
            }
        } catch (error) {
            console.error(`Errore nel recupero batch artisti [${i}-${i + BATCH_SIZE}]:`, error.message);
        }
    }
    
    return artistDetails;
};

// =================================================================
// --- Servizi di Elaborazione Dati (Logica di Business) ---
// =================================================================

/**
 * Processa i dati grezzi delle tracce in un formato strutturato e calcola le statistiche.
 */
const processPlaylistTracks = (allTracks) => {
    let totalDurationMs = 0;
    const albumsInPlaylist = {};
    const artistCounts = {};
    const artistIds = new Set();

    for (const item of allTracks) {
        const { track } = item;
        if (!track) continue;

        totalDurationMs += track.duration_ms || 0;

        // Conteggio artisti e raccolta ID
        track.artists?.forEach(artist => {
            if (artist.id) {
                artistIds.add(artist.id);
                
                if (!artistCounts[artist.id]) {
                    artistCounts[artist.id] = { 
                        id: artist.id, 
                        name: artist.name, 
                        trackCount: 0,
                        image: null
                    };
                }
                artistCounts[artist.id].trackCount++;
            }
        });

        // Raggruppamento album (filtra singoli)
        const { album } = track;
        if (!album?.id || album.total_tracks <= 1) continue;
        
        if (!albumsInPlaylist[album.id]) {
            albumsInPlaylist[album.id] = {
                id: album.id,
                name: album.name,
                image: album.images?.[0]?.url || CONFIG.PLACEHOLDER_IMAGE,
                artist: album.artists.map(a => a.name).join(', '),
                totalTracks: album.total_tracks,
                tracksPresent: 0
            };
        }
        albumsInPlaylist[album.id].tracksPresent++;
    }

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
        albums: sortedAlbums,
        artistIds: Array.from(artistIds)
    };
};

/**
 * Calcola le statistiche dei generi musicali dalla lista di artisti arricchiti
 */
const calculateGenreStats = (enrichedArtists) => {
    const genreCounts = {};
    let totalGenreOccurrences = 0;

    enrichedArtists.forEach(artist => {
        if (artist.genres && artist.genres.length > 0) {
            artist.genres.forEach(genre => {
                if (!genreCounts[genre]) {
                    genreCounts[genre] = { name: genre, count: 0, artists: [] };
                }
                genreCounts[genre].count += artist.trackCount;
                if (!genreCounts[genre].artists.includes(artist.name)) {
                    genreCounts[genre].artists.push(artist.name);
                }
                totalGenreOccurrences += artist.trackCount;
            });
        }
    });

    const genres = Object.values(genreCounts)
        .map(genre => ({
            ...genre,
            percentage: totalGenreOccurrences > 0 
                ? Math.round((genre.count / totalGenreOccurrences) * 100) 
                : 0
        }))
        .sort((a, b) => b.count - a.count);

    return {
        genres,
        totalGenreOccurrences,
        uniqueGenres: genres.length
    };
};

/**
 * Arricchisce i dati degli artisti con le immagini
 */
const enrichArtistsWithImages = (artists, artistDetails) => {
    return artists.map(artist => ({
        ...artist,
        image: artistDetails[artist.id]?.image || CONFIG.PLACEHOLDER_IMAGE,
        genres: artistDetails[artist.id]?.genres || []
    }));
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
        if (err.message === 'UNAUTHORIZED') { 
            req.session.destroy(); 
            return res.redirect('/start'); 
        }
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

    const view = ['artist', 'genre'].includes(req.query.view) ? req.query.view : 'album';
    const page = validatePageNumber(req.query.page);

    try {
        const cacheKey = `playlist-details:${playlistId}`;
        let processedData = appCache.get(cacheKey);

        if (!processedData) {
            console.log(`CACHE MISS: Elaborando dettagli per playlist ${playlistId}`);
            
            // Fetch parallelo di info playlist e tracce
            const [playlistInfo, allTracks] = await Promise.all([
                makeSpotifyRequest(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}`, accessToken),
                fetchAllPlaylistTracks(playlistId, accessToken)
            ]);
            
            // Processa le tracce e ottieni gli ID degli artisti
            const processed = processPlaylistTracks(allTracks);
            
            // Fetch delle immagini degli artisti
            let enrichedArtists = processed.artists;
            if (processed.artistIds.length > 0) {
                console.log(`Recupero immagini per ${processed.artistIds.length} artisti...`);
                const artistDetails = await fetchArtistsDetails(processed.artistIds, accessToken);
                enrichedArtists = enrichArtistsWithImages(processed.artists, artistDetails);
            }
            
            // Calcola statistiche dei generi
            const genreStats = calculateGenreStats(enrichedArtists);

            processedData = {
                playlistInfo,
                stats: {
                    ...processed.stats,
                    uniqueGenres: genreStats.uniqueGenres
                },
                artists: enrichedArtists,
                albums: processed.albums,
                genres: genreStats.genres
            };
            
            // Cache per 30 minuti
            appCache.set(cacheKey, processedData, 1800);
            console.log(`✅ Dati playlist ${playlistId} salvati in cache con ${enrichedArtists.length} artisti e ${genreStats.uniqueGenres} generi`);
        } else {
            console.log(`CACHE HIT: Trovati dettagli per playlist ${playlistId} in cache.`);
        }

        let dataForView;
        let itemsPerPage;
        let totalItems;

        switch (view) {
            case 'artist':
                dataForView = processedData.artists;
                itemsPerPage = CONFIG.MAX_ARTISTS_DISPLAYED;
                break;
            case 'genre':
                dataForView = processedData.genres;
                itemsPerPage = processedData.genres.length; // mostra tutti
                break;
            default: // album
                dataForView = processedData.albums;
                itemsPerPage = CONFIG.ALBUMS_PER_PAGE;
        }

        totalItems = dataForView.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const paginatedContent = dataForView.slice((page - 1) * itemsPerPage, page * itemsPerPage);

        const viewData = {
            playlist: processedData.playlistInfo,
            stats: processedData.stats,
            view,
            page,
            contentData: paginatedContent,
            totalPages
        };
        
        res.send(renderPlaylistDetailPage(viewData));
    } catch (err) {
        console.error(`Errore nel recuperare dettagli per playlist ${playlistId}:`, err.message);
        if (err.message === 'UNAUTHORIZED') { 
            req.session.destroy(); 
            return res.redirect('/start'); 
        }
        handleError(res, "Errore nel recuperare i dettagli della playlist.");
    }
};

module.exports = { 
    getPlaylistsPage, 
    getPlaylistDetailPage,
};
