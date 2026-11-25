/**
 * Health check usado pela pipeline de CD para confirmar o deploy.
 */
jest.mock('../../src/config/database', () => ({ getConnection: jest.fn(), query: jest.fn() }));

const request = require('supertest');
const app = require('../../src/app');

describe('GET /health', () => {
  test('responde status ok e o commit publicado', async () => {
    process.env.GIT_COMMIT = 'abc123';

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', commit: 'abc123' });
  });
});
