const { validatePlaylistId } = require('../utils/helpers');
const { calculatePlaylistDuration } = require('./playlistController'); // Importa la logica di calcolo
const { formatDuration } = require('../utils/helpers');

/**
 * Gestisce la richiesta API per calcolare e restituire la durata
 * di una singola playlist. I dati vengono restituiti in formato JSON.
 */
const getPlaylistDuration = async (req, res) => {
  try {
    const accessToken = req.session.accessToken;
    const { playlistId } = req.params;

    // 1. Validazione e Autenticazione
    if (!accessToken) {
      // Per una API, è meglio restituire un errore JSON piuttosto che un redirect.
      return res.status(401).json({ error: 'Unauthorized: No active session.' });
    }
    if (!validatePlaylistId(playlistId)) {
      return res.status(400).json({ error: 'Invalid or missing Playlist ID.' });
    }

    // 2. Calcolo della Durata
    // Usiamo uno "stub" della playlist che contiene solo l'ID,
    // poiché è tutto ciò che la funzione di calcolo richiede.
    const playlistStub = { id: playlistId };
    const result = await calculatePlaylistDuration(playlistStub, accessToken);

    if (result.error) {
      // Se c'è stato un errore durante il calcolo (es. la playlist non è stata trovata da Spotify)
      throw new Error('Calculation failed internally.');
    }
    
    // 3. Formattazione e Risposta
    // La risposta JSON contiene il testo della durata già formattato,
    // così il frontend deve solo visualizzarlo.
    res.status(200).json({ 
      durationText: formatDuration(result.totalDuration) 
    });

  } catch (error) {
    // 4. Gestione Errori Generica
    console.warn(`API error for duration on playlist ${req.params.playlistId}:`, error.message);
    res.status(500).json({ 
      error: 'Could not calculate duration.',
      durationText: 'Errore' // Fornisci un testo di fallback per il frontend
    });
  }
};

module.exports = {
  getPlaylistDuration,
};
