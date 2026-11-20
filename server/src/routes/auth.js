import { Router } from "express"
import prisma from "../db.js"
import {
  hashPassword,
  comparePassword,
  generateToken,
  setAuthCookie,
  clearAuthCookie,
} from "../lib/auth.js"
import { signupSchema, loginSchema } from "../schemas/auth.js"
import { requireAuth } from "../middleware/auth.js"

const router = Router()

router.post("/signup", async (req, res) => {
  try {
    const parseResult = signupSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const { email, password, name } = parseResult.data
    const inviteCode =
      req.body.instructor_invite_code ||
      req.body.instructorInviteCode ||
      req.body.inviteCode

    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return res.status(409).json({ error: "Email already in use" })
    }

    const correctCode = process.env.INSTRUCTOR_INVITE_CODE
    const role =
      inviteCode && correctCode && inviteCode === correctCode
        ? "INSTRUCTOR"
        : "STUDENT"

    const hashedPassword = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name: name || null,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    })

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    setAuthCookie(res, token)

    return res.status(201).json({ user })
  } catch (err) {
    console.error("Signup error:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
})

router.post("/login", async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body)
    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: parseResult.error.flatten().fieldErrors,
      })
    }

    const { email, password } = parseResult.data

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" })
    }

    const isValid = await comparePassword(password, user.password)
    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" })
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    })

    setAuthCookie(res, token)

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
    })
  } catch (err) {
    console.error("Login error:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
})

router.post("/logout", (req, res) => {
  clearAuthCookie(res)
  return res.json({ message: "Logged out successfully" })
})

router.get("/me", requireAuth, (req, res) => {
  return res.json({ user: req.user })
})

export default router
