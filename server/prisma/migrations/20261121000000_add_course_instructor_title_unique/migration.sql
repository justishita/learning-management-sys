-- AddUniqueConstraint
ALTER TABLE "Course" ADD CONSTRAINT "Course_instructorId_title_key" UNIQUE ("instructorId", "title");
