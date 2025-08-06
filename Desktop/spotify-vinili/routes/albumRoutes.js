const express = require('express');
const { getAlbumDetails } = require('../controllers/albumController');
const router = express.Router();

/**
 * Definisce le rotte relative agli album.
 * Il prefisso del percorso (es. '/album') viene definito nel file principale server.js
 * quando questo router viene montato.
 */

// ROTTA: GET /album/:id
// DESCRIZIONE: Mostra la pagina di dettaglio per un album specifico.
// CONTROLLER: getAlbumDetails gestisce la logica di recupero dati e renderizzazione.
router.get('/:id', getAlbumDetails);

module.exports = router;
