/**
 * Processa i dati grezzi delle tracce in un formato strutturato e calcola le statistiche.
 * Esegue un unico ciclo sull'array delle tracce per massima efficienza.
 * MODIFICATO: Ora filtra i singoli (album con 1 sola traccia)
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
        
        // ⭐ FILTRO SINGOLI: Ignora album con 1 sola traccia
        if (album.total_tracks <= 1) continue;
        
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
