import { type Request, type Response } from "express";
import z from "zod";
import { prisma } from "../prisma.js";


export const studentClasses = async (req: Request, res: Response) => {

    try {
        const classes = await prisma.class.findMany({
            where: { enrollments: { some: { studentId: req.userId! } } },
            select: {
                id: true,
                name: true,
                isAttendanceOpen: true
            }
        });

        const total = await prisma.class.count({
            where: { enrollments: { some: { studentId: req.userId! } } }
        });

        res.json({ total, classes });
    } catch (err) {
        console.error("Get classes error:", err);
        res.status(500).json({ message: "Server error" });
    }
};


export const markAttendance = async (req: Request, res: Response) => {
    if (req.role !== "STUDENT") {
        return res.status(400).json({ message: "Only students can mark attendance" });
    }

    try {
        const schema = z.object({
            classId: z.number(),
        });

        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ message: "Invalid input" });
        }

        const { classId } = result.data;
        const status = "PRESENT";

        const class_ = await prisma.class.findUnique({ where: { id: classId } });
        if (!class_) return res.status(400).json({ message: "Class not found" });

        const enrolled = await prisma.enrollment.findFirst({
            where: { classId: classId, studentId: req.userId! }
        });
        if (!enrolled) {
            return res.status(403).json({ message: "You are not enrolled in this class" });
        }

        if (!class_.isAttendanceOpen) {
            return res.status(400).json({ message: "Class is not open for attendance" });
        }
        const existingAttendance = await prisma.attendance.findFirst({
            where: {
                classId,
                studentId: req.userId!,
            }
        });
        if (existingAttendance) {
            return res.status(400).json({ message: "You already marked attendance for today" });
        }

        const newAttendance = await prisma.attendance.create({
            data: {
                classId: classId,
                studentId: req.userId!,
                status: status
            }
        });

        res.status(200).json({
            message: "Attendance marked successfully",
            newAttendance
        });
    } catch (err) {
        console.error("Mark attendance error:", err);
        res.status(500).json({ message: "Server error" });
    }
};