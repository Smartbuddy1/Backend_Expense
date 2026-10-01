const request = require('supertest');
const express = require('express');
const authRouter = require('../src/routes/auth');

const app = express();
app.use(express.json());
// Mock rate limiter by overriding
jest.mock('express-rate-limit', () => ({
  rateLimit: () => (req, res, next) => next(),
  ipKeyGenerator: () => '127.0.0.1',
}));
app.use('/auth', authRouter);

describe('Auth API', () => {
  it('should return 400 if mobile is missing', async () => {
    const res = await request(app).post('/auth/login').send({
      password: 'password123',
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 400 if password is missing', async () => {
    const res = await request(app).post('/auth/login').send({
      mobile: '1234567890',
    });
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
  });
});
