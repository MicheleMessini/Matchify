const NodeCache = require('node-cache');

// Crea una singola istanza della cache con una durata standard (TTL) di 15 minuti.
// Esportando l'istanza, ti assicuri che sia la stessa in tutta l'applicazione.
const appCache = new NodeCache({ stdTTL: 900 });

module.exports = appCache;
