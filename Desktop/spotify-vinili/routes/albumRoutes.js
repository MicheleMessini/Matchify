const express = require('express');
const { getAlbumDetails } = require('../controllers/albumController');
const router = express.Router();

// Il percorso qui è relativo a dove monti il router in server.js
// Se lo monti con app.use('/album', albumRoutes), questo corrisponderà a /album/:id
router.get('/:id', getAlbumDetails);

module.exports = router;
