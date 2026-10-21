"""
Backend API integration tests using supertest pattern.
Tests: auth flow, assessment ownership checks, assessment CRUD, access control.
"""
import request from 'supertest'
import { app } from '../src/index'
import { pool } from '../src/db/pool'

// Shared state for test session
let authToken = ''
let userId = ''
let assessmentId = ''
const testEmail = `test_${Date.now()}@example.com`
const testPassword = 'TestPassword123!'

// Clean up after tests
afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email = $1', [testEmail])
  await pool.end()
})

describe('Auth Endpoints', () => {
  test('POST /api/auth/register — success', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: testEmail, password: testPassword })
    expect(res.status).toBe(201)
    expect(res.body.token).toBeDefined()
    expect(res.body.user.email).toBe(testEmail)
    authToken = res.body.token
    userId = res.body.user.id
  })

  test('POST /api/auth/register — duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: testEmail, password: testPassword })
    expect(res.status).toBe(409)
  })

  test('POST /api/auth/register — weak password rejected', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: `other_${Date.now()}@example.com`, password: 'short' })
    expect(res.status).toBe(400)
  })

  test('POST /api/auth/login — success', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: testPassword })
    expect(res.status).toBe(200)
    expect(res.body.token).toBeDefined()
  })

  test('POST /api/auth/login — wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: testEmail, password: 'wrongpassword' })
    expect(res.status).toBe(401)
  })

  test('GET /api/auth/me — authenticated', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`)
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(testEmail)
  })

  test('GET /api/auth/me — no token returns 401', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})

describe('Assessment Endpoints', () => {
  test('POST /api/assessments — success', async () => {
    const res = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ target: 'example.com', authorized: true, protocols: ['ftp', 'redis'] })
    expect(res.status).toBe(201)
    expect(res.body.assessment.target).toBe('example.com')
    assessmentId = res.body.assessment.id
  })

  test('POST /api/assessments — missing auth', async () => {
    const res = await request(app)
      .post('/api/assessments')
      .send({ target: 'example.com', authorized: true, protocols: ['ftp'] })
    expect(res.status).toBe(401)
  })

  test('POST /api/assessments — invalid target', async () => {
    const res = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ target: 'not a valid domain!@#', authorized: true, protocols: ['ftp'] })
    expect(res.status).toBe(400)
  })

  test('POST /api/assessments — authorization not confirmed', async () => {
    const res = await request(app)
      .post('/api/assessments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ target: 'example.com', authorized: false, protocols: ['ftp'] })
    expect(res.status).toBe(400)
  })

  test('GET /api/assessments — returns user assessments', async () => {
    const res = await request(app)
      .get('/api/assessments')
      .set('Authorization', `Bearer ${authToken}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.assessments)).toBe(true)
  })

  test('GET /api/assessments/:id — ownership enforced', async () => {
    // Register a second user and try to read first user's assessment
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ email: `other2_${Date.now()}@example.com`, password: testPassword })
    const token2 = res2.body.token

    const res = await request(app)
      .get(`/api/assessments/${assessmentId}`)
      .set('Authorization', `Bearer ${token2}`)
    expect(res.status).toBe(404) // Ownership check → 404 (not 403, to avoid enumeration)
  })
})

describe('Dashboard', () => {
  test('GET /api/dashboard/summary — authenticated', async () => {
    const res = await request(app)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${authToken}`)
    expect(res.status).toBe(200)
    expect(typeof res.body.total_assessments).toBe('number')
  })

  test('GET /api/dashboard/summary — unauthenticated returns 401', async () => {
    const res = await request(app).get('/api/dashboard/summary')
    expect(res.status).toBe(401)
  })
})

describe('Health', () => {
  test('GET /api/health — ok', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
