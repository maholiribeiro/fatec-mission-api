// Variáveis de ambiente fixas para os testes (nenhum teste acessa um MySQL real).
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'test';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'fatec_mission_test';
process.env.JWT_SECRET = 'segredo-de-teste';
process.env.JWT_EXPIRES_IN = '1h';
process.env.BCRYPT_SALT_ROUNDS = '4';
