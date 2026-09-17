const request = require('supertest');
// Note: For proper enterprise testing, Express 'app' should be exported from index.js
// or separated into app.js so it can be required here without binding to a port.

describe('API Health Check', () => {
  it('should return 200 OK from the /health endpoint', async () => {
    // We assume the server is running on localhost:5000 for this basic E2E test,
    // though typically supertest binds directly to the express 'app' instance.
    const res = await request('http://localhost:5000').get('/health');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('status', 'ok');
  });
});
