import request from 'supertest';
import app from '../src/index';

describe('GET /health', () => {
  it('returns HTTP 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('returns correct JSON body', async () => {
    const res = await request(app).get('/health');
    expect(res.body).toEqual({ status: 'ok', version: '1.0.0' });
  });

  it('returns application/json content type', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
