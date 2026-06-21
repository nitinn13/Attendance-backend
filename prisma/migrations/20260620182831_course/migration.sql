/*
  Warnings:

  - You are about to drop the column `classId` on the `Attendance` table. All the data in the column will be lost.
  - You are about to drop the column `classDate` on the `Class` table. All the data in the column will be lost.
  - You are about to drop the column `isAttendanceOpen` on the `Class` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sessionId,studentId]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sessionId` to the `Attendance` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endDate` to the `Class` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `Class` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."Weekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- DropForeignKey
ALTER TABLE "public"."Attendance" DROP CONSTRAINT "Attendance_classId_fkey";

-- DropIndex
DROP INDEX "public"."Attendance_classId_studentId_key";

-- AlterTable
ALTER TABLE "public"."Attendance" DROP COLUMN "classId",
ADD COLUMN     "sessionId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."Class" DROP COLUMN "classDate",
DROP COLUMN "isAttendanceOpen",
ADD COLUMN     "endDate" DATE NOT NULL,
ADD COLUMN     "recurrenceDays" "public"."Weekday"[],
ADD COLUMN     "startDate" DATE NOT NULL;

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" SERIAL NOT NULL,
    "classId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "isAttendanceOpen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_classId_date_key" ON "public"."Session"("classId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_sessionId_studentId_key" ON "public"."Attendance"("sessionId", "studentId");

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_classId_fkey" FOREIGN KEY ("classId") REFERENCES "public"."Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attendance" ADD CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
