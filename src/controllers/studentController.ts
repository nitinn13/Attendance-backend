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
                recurrenceDays: true,
                startDate: true,
                endDate: true,
                sessions: {
                    orderBy: { date: "asc" },
                    select: {
                        id: true,
                        date: true,
                        isAttendanceOpen: true
                    }
                }
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
            sessionId: z.number(),
        });

        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ message: "Invalid input" });
        }

        const { sessionId } = result.data;
        const status = "PRESENT";

        const session = await prisma.session.findUnique({
            where: { id: sessionId }
        });
        if (!session) return res.status(400).json({ message: "Session not found" });

        const enrolled = await prisma.enrollment.findFirst({
            where: { classId: session.classId, studentId: req.userId! }
        });
        if (!enrolled) {
            return res.status(403).json({ message: "You are not enrolled in this class" });
        }

        if (!session.isAttendanceOpen) {
            return res.status(400).json({ message: "Attendance is not open for this session" });
        }

        const existingAttendance = await prisma.attendance.findFirst({
            where: {
                sessionId,
                studentId: req.userId!,
            }
        });
        if (existingAttendance) {
            return res.status(400).json({ message: "You already marked attendance for this session" });
        }

        const newAttendance = await prisma.attendance.create({
            data: {
                sessionId,
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