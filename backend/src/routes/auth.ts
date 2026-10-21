import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { query } from '../db/pool'
import { requireAuth, AuthRequest } from '../middleware/auth'
import { logger } from '../utils/logger'

const router = Router()

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function signToken(userId: string, role: string): string {
  const secret = process.env.JWT_SECRET!
  return jwt.sign({ sub: userId, role }, secret, { expiresIn: '7d' })
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = RegisterSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message })
    return
  }

  const { email, password } = parsed.data

  try {
    const existing = await query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'An account with this email already exists' })
      return
    }

    const password_hash = await bcrypt.hash(password, 12)
    const { rows } = await query<{ id: string; email: string; role: string; created_at: string }>(
      `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'analyst') RETURNING id, email, role, created_at`,
      [email, password_hash]
    )

    const user = rows[0]
    const token = signToken(user.id, user.role)
    logger.info('User registered', { userId: user.id })
    res.status(201).json({ token, user })
  } catch (err) {
    logger.error('Register error', { error: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ error: 'Registration failed' })
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid email or password format' })
    return
  }

  const { email, password } = parsed.data

  try {
    const { rows } = await query<{ id: string; email: string; password_hash: string; role: string; created_at: string }>(
      'SELECT id, email, password_hash, role, created_at FROM users WHERE email = $1',
      [email]
    )

    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const user = rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' })
      return
    }

    const token = signToken(user.id, user.role)
    logger.info('User logged in', { userId: user.id })
    res.json({
      token,
      user: { id: user.id, email: user.email, role: user.role, created_at: user.created_at },
    })
  } catch (err) {
    logger.error('Login error', { error: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ error: 'Login failed' })
  }
})

// POST /api/auth/logout
router.post('/logout', requireAuth, (_req: Request, res: Response): void => {
  // JWT is stateless; client removes the token. 
  // A token blacklist can be added here for production.
  res.json({ message: 'Logged out successfully' })
})

// GET /api/auth/me
router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rows } = await query<{ id: string; email: string; role: string; created_at: string }>(
      'SELECT id, email, role, created_at FROM users WHERE id = $1',
      [req.userId!]
    )
    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' })
      return
    }
    res.json({ user: rows[0] })
  } catch (err) {
    logger.error('Get user error', { error: err instanceof Error ? err.message : String(err) })
    res.status(500).json({ error: 'Failed to fetch user' })
  }
})

export default router
