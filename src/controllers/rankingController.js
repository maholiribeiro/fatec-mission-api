const rankingService = require('../services/rankingService');

async function obter(req, res) {
  res.json(await rankingService.obter(req.query));
}

module.exports = { obter };
