import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { logger } from '../utils/logger'

export interface AuthRequest extends Request {
  userId?: string
  userRole?: string
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  const token = header.slice(7)
  const secret = process.env.JWT_SECRET
  if (!secret) {
    logger.error('JWT_SECRET not configured')
    res.status(500).json({ error: 'Server configuration error' })
    return
  }

  try {
    const payload = jwt.verify(token, secret) as { sub: string; role: string }
    req.userId = payload.sub
    req.userRole = payload.role
    next()
  } catch (err) {
    logger.debug('JWT verification failed', { error: err instanceof Error ? err.message : String(err) })
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.userRole !== 'admin') {
    res.status(403).json({ error: 'Admin access required' })
    return
  }
  next()
}
