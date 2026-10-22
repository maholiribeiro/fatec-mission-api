const adminService = require('../services/adminService');

async function dashboard(req, res) {
  res.json(await adminService.dashboard());
}

/** GET /admin/usuarios?formato=json|csv */
async function usuarios(req, res) {
  if (req.query.formato === 'csv') {
    const data = new Date().toISOString().slice(0, 10);
    res
      .type('text/csv; charset=utf-8')
      .attachment(`usuarios-fatec-mission-${data}.csv`)
      .send(await adminService.exportarUsuariosCsv());
    return;
  }
  res.json(await adminService.listarUsuarios());
}

module.exports = { dashboard, usuarios };
