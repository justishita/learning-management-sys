import { verifyToken, AUTH_COOKIE_NAME } from "../lib/auth.js"

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME]
    if (!token) {
      return res.status(401).json({ error: "Authentication required" })
    }

    const decoded = verifyToken(token)
    if (!decoded?.userId || !decoded?.role) {
      return res.status(401).json({ error: "Invalid token payload" })
    }

    // Trust JWT claims — avoids a DB round-trip on every request.
    // The token already carries userId, email, name, and role; it is
    // cryptographically signed and expires in 7 days.
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name ?? null,
      role: decoded.role,
    }
    next()
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" })
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME]
    if (token) {
      const decoded = verifyToken(token)
      if (decoded?.userId && decoded?.role) {
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          name: decoded.name ?? null,
          role: decoded.role,
        }
      }
    }
  } catch (err) {
    // Ignore errors for optional authentication
  }
  next()
}

export function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" })
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden: insufficient permissions" })
    }
    next()
  }
}
