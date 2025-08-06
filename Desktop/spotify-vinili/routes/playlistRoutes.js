const express = require('express');
const { getPlaylistsPage, getPlaylistDetailPage } = require('../controllers/playlistController');
const router = express.Router();

/**
 * Definisce le rotte principali dell'applicazione relative alla visualizzazione delle playlist.
 * Il prefisso di questo router sarà '/' quando montato nel file server.js.
 */

// ROTTA: GET /
// DESCRIZIONE: Mostra la pagina principale con l'elenco delle playlist dell'utente.
//              Questa è la pagina che l'utente vede dopo aver effettuato il login.
// CONTROLLER: getPlaylistsPage gestisce il recupero dati e la renderizzazione della pagina.
router.get('/', getPlaylistsPage);

// ROTTA: GET /playlist/:id
// DESCRIZIONE: Mostra la pagina di dettaglio per una singola playlist.
//              L':id nel percorso è un parametro dinamico che corrisponde all'ID della playlist.
// CONTROLLER: getPlaylistDetailPage gestisce la logica per la singola playlist.
router.get('/playlist/:id', getPlaylistDetailPage);


module.exports = router;
