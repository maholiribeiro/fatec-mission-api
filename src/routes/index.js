const { Router } = require('express');

const router = Router();

router.use(require('./authRoutes'));
router.use(require('./usuarioRoutes'));
router.use(require('./missaoRoutes'));
router.use(require('./quizRoutes'));
router.use(require('./rankingRoutes'));
router.use(require('./conquistaRoutes'));
router.use(require('./adminRoutes'));

module.exports = router;
