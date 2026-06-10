/*
  Warnings:

  - A unique constraint covering the columns `[classId,studentId]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."Attendance_classId_studentId_date_key";

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_classId_studentId_key" ON "public"."Attendance"("classId", "studentId");
