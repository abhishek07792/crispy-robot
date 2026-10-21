
import dotenv from 'dotenv'
import path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import { pool } from './db/pool'
import { logger } from './utils/logger'

// Route imports
import authRoutes        from './routes/auth'
import assessmentRoutes from './routes/assessments'
import findingRoutes    from './routes/findings'
import cveRoutes        from './routes/cves'
import dashboardRoutes  from './routes/dashboard'

const app = express()
const PORT = Number(process.env.BACKEND_PORT || 3001)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// ── Security middleware ───────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}))

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
}))

app.use(express.json({ limit: '1mb' }))

// ── Auth routes get tighter rate limiting ─────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many auth attempts, try again later.' },
})

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' },
})

// ── Swagger / OpenAPI ──────────────────────────────────────────────────────────
const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'VAPT Framework API',
      version: '1.0.0',
      description: 'Multi-Protocol Exposure & Risk-Scoring Framework — REST API',
    },
    servers: [{ url: `http://localhost:${PORT}`, description: 'Development' }],
    components: {
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts'],
})
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
app.get('/api/openapi.json', (_req, res) => res.json(swaggerSpec))

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth',        authLimiter,  authRoutes)
app.use('/api/assessments', apiLimiter,   assessmentRoutes)
app.use('/api/findings',    apiLimiter,   findingRoutes)
app.use('/api/cves',        apiLimiter,   cveRoutes)
app.use('/api/dashboard',   apiLimiter,   dashboardRoutes)

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', database: 'connected', service: 'vapt-backend', timestamp: new Date().toISOString() })
  } catch (error) {
    logger.error('Health check failed', { error: error instanceof Error ? error.message : String(error) })
    res.status(503).json({ status: 'error', database: 'unavailable' })
  }
})

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack?.slice(0, 300) })
  res.status(500).json({ error: 'Internal server error' })
})

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// ── Startup ───────────────────────────────────────────────────────────────────
async function startServer() {
  try {
    await pool.query('SELECT 1')
    logger.info('Database connection verified')

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`VAPT backend running on port ${PORT}`)
      logger.info(`API docs: http://localhost:${PORT}/api/docs`)
      if (!process.env.SHODAN_API_KEY) logger.warn('SHODAN_API_KEY not set — running in demo mode')
      if (!process.env.NVD_API_KEY)    logger.warn('NVD_API_KEY not set — NVD rate limits will apply')
    })
  } catch (error) {
    logger.error('Failed to start backend', { error: error instanceof Error ? error.message : String(error) })
    process.exit(1)
  }
}

if (require.main === module) {
  void startServer()
}

export { app }
