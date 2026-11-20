import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const instructorPassword = await bcrypt.hash("instructor@123", 10)
  const studentPassword = await bcrypt.hash("student@123", 10)

  const instructor = await prisma.user.upsert({
    where: { email: "instructor@lms.test" },
    update: {
      password: instructorPassword,
      role: "INSTRUCTOR",
    },
    create: {
      email: "instructor@lms.test",
      password: instructorPassword,
      name: "Instructor",
      role: "INSTRUCTOR",
    },
  })

  const student = await prisma.user.upsert({
    where: { email: "student@lms.test" },
    update: {
      password: studentPassword,
      role: "STUDENT",
    },
    create: {
      email: "student@lms.test",
      password: studentPassword,
      name: "Student",
      role: "STUDENT",
    },
  })

  console.log("Seeded users:", {
    instructor: { id: instructor.id, email: instructor.email, role: instructor.role },
    student: { id: student.id, email: student.email, role: student.role },
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
