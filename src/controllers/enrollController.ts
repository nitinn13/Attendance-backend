import { type Request, type Response } from "express";
import z from "zod";
import { prisma } from "../prisma.js";


export const enrollStudents = async (req: Request, res: Response) => {
    if (req.role !== "ADMIN") {
        return res.status(400).json({ message: "Only admin can enroll students" });
    }

    try {
        const enrollmentSchema = z.object({
            classId: z.number(),
            studentId: z.number(),
        });
        const result = enrollmentSchema.safeParse(req.body);
        if (!result.success) {
            console.log("Validation Error:", result.error.format());
            return res.status(400).json({ message: "Invalid input" });
        }

        const { classId, studentId } = result.data;

        const class_ = await prisma.class.findUnique({
            where: { id: classId }
        });

        if (!class_) return res.status(400).json({ message: "Class not found" });

        const student = await prisma.user.findUnique({
            where: { userId: studentId }
        });

        if (!student || student.role !== "STUDENT") {
            return res.status(400).json({ message: "Invalid student" });
        }

        const existingEnrollment = await prisma.enrollment.findUnique({
            where: {
                classId_studentId: {
                    classId: class_.id,
                    studentId: student.userId
                }
            }
        });

        if (existingEnrollment) {
            return res.status(400).json({ message: "Student already enrolled" });
        }

        const newEnrollment = await prisma.enrollment.create({
            data: {
                classId: class_.id,
                studentId: student.userId
            }
        });

        res.status(200).json({
            message: "Student enrolled successfully",
            newEnrollment: {
                id: newEnrollment.id,
                classId: newEnrollment.classId,
                studentId: newEnrollment.studentId
            }
        });
    } catch (err) {
        console.error("Enroll students error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const enrollAllStudents = async (req: Request, res: Response) => {
    if (req.role !== "ADMIN") {
        return res.status(400).json({ message: "Only admin can enroll students" });
    }

    try {
        const schema = z.object({
            classId: z.number()
        });

        const result = schema.safeParse(req.body);
        if (!result.success) {
            console.log("Validation Error:", result.error.format());
            return res.status(400).json({ message: "Invalid input" });
        }

        const { classId } = result.data;

        // Check if class exists
        const class_ = await prisma.class.findUnique({
            where: { id: classId }
        });

        if (!class_) {
            return res.status(404).json({ message: "Class not found" });
        }

        // Get all students
        const allStudents = await prisma.user.findMany({
            where: { role: "STUDENT" },
            select: { userId: true }
        });

        if (allStudents.length === 0) {
            return res.status(400).json({ message: "No students found to enroll" });
        }

        // Get already enrolled students in the class
        const existingEnrollments = await prisma.enrollment.findMany({
            where: { classId },
            select: { studentId: true }
        });

        const alreadyEnrolledIds = new Set(existingEnrollments.map(e => e.studentId));

        // Filter out students already enrolled
        const newStudents = allStudents.filter(s => !alreadyEnrolledIds.has(s.userId));

        if (newStudents.length === 0) {
            return res.status(400).json({ message: "All students are already enrolled in this class" });
        }

        // Bulk create enrollments
        const createdEnrollments = await prisma.enrollment.createMany({
            data: newStudents.map(s => ({
                classId,
                studentId: s.userId
            })),
            skipDuplicates: true
        });

        return res.status(200).json({
            message: "Students enrolled successfully",
            totalStudents: allStudents.length,
            newlyEnrolled: createdEnrollments.count,
            skipped: allStudents.length - createdEnrollments.count
        });
    } catch (err) {
        console.error("Enroll all students error:", err);
        res.status(500).json({ message: "Server error" });
    }
};


export const allEnrollments = async (req: Request, res: Response) => {
    if (req.role !== "ADMIN") {
        return res.status(400).json({ message: "Only admin can get enrollments" });
    }
    try {
        const enrollments = await prisma.enrollment.findMany({
            include: { class: true, student: true }
        });
        res.json(enrollments);
    } catch (err) {
        console.error("Get enrollments error:", err);
        res.status(500).json({ message: "Server error" });
    }
};