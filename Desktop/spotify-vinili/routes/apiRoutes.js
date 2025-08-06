const express = require('express');
const { getPlaylistDuration } = require('../controllers/apiController');
const router = express.Router();

/**
 * Definisce le rotte dedicate all'API.
 * Queste rotte sono pensate per essere chiamate da codice client (es. JavaScript con fetch)
 * e generalmente restituiscono dati in formato JSON.
 *
 * Il prefisso del percorso (es. '/api') viene definito nel file principale server.js.
 */

// ROTTA: GET /api/duration/:playlistId
// DESCRIZIONE: Recupera la durata calcolata di una specifica playlist.
// CONTROLLER: getPlaylistDuration gestisce la logica di calcolo e la risposta JSON.
router.get('/duration/:playlistId', getPlaylistDuration);

// --- Esempio per future API ---
// Se in futuro volessi aggiungere un'altra API, ad esempio per ottenere statistiche
// di un utente, la aggiungeresti qui:
// router.get('/user-stats', getUserStatsController);

module.exports = router;
