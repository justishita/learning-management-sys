import { verifyToken, AUTH_COOKIE_NAME } from "../lib/auth.js"
import prisma from "../db.js"

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME]
    if (!token) {
      return res.status(401).json({ error: "Authentication required" })
    }

    const decoded = verifyToken(token)
    if (!decoded?.userId) {
      return res.status(401).json({ error: "Invalid token payload" })
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })

    if (!user) {
      return res.status(401).json({ error: "User not found" })
    }

    req.user = user
    next()
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" })
  }
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
