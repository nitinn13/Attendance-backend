import { type Request, type Response } from "express";
import z from "zod";
import { prisma } from "../prisma.js";

export const myClasses = async (req: Request, res: Response) => {
    if (req.role !== "TEACHER") {
        return res.status(400).json({ message: "Only teachers can get their classes" });
    }

    try {
        const classes = await prisma.class.findMany({
            where: { teacherId: req.userId! },
            select: {
                id: true,
                name: true,
                recurrenceDays: true,
                startDate: true,
                endDate: true,
                enrollments: {
                    select: { id: true, studentId: true }
                },
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
            where: { teacherId: req.userId! }
        });

        res.json({ total, classes });
    } catch (err) {
        console.error("Get classes error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const openAttendance = async (req: Request, res: Response) => {
    if (req.role !== "TEACHER") {
        return res.status(400).json({ message: "Only teachers can open attendance" });
    }

    try {
        const schema = z.object({ sessionId: z.number() });
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ message: "Invalid input" });
        }

        const { sessionId } = result.data;

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { class: true }
        });
        if (!session) return res.status(400).json({ message: "Session not found" });

        if (session.class.teacherId !== req.userId) {
            return res.status(403).json({ message: "You are not authorized to open attendance" });
        }

        if (session.isAttendanceOpen) {
            return res.status(400).json({ message: "Session is already open for attendance" });
        }

        const updated = await prisma.session.update({
            where: { id: sessionId },
            data: { isAttendanceOpen: true }
        });

        res.status(200).json({
            message: "Attendance opened successfully",
            session: {
                id: updated.id,
                classId: updated.classId,
                date: updated.date.toISOString().split("T")[0],
                isAttendanceOpen: updated.isAttendanceOpen
            }
        });
    } catch (err) {
        console.error("Open attendance error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const closeAttendance = async (req: Request, res: Response) => {
    if (req.role !== "TEACHER") {
        return res.status(400).json({ message: "Only teachers can close attendance" });
    }

    try {
        const schema = z.object({ sessionId: z.number() });
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ message: "Invalid input" });
        }

        const { sessionId } = result.data;

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { class: true }
        });
        if (!session) return res.status(400).json({ message: "Session not found" });

        if (session.class.teacherId !== req.userId) {
            return res.status(403).json({ message: "You are not authorized to close attendance" });
        }

        if (!session.isAttendanceOpen) {
            return res.status(400).json({ message: "Session is already closed for attendance" });
        }

        const updated = await prisma.session.update({
            where: { id: sessionId },
            data: { isAttendanceOpen: false }
        });

        res.status(200).json({
            message: "Attendance closed successfully",
            session: {
                id: updated.id,
                classId: updated.classId,
                date: updated.date.toISOString().split("T")[0],
                isAttendanceOpen: updated.isAttendanceOpen
            }
        });
    } catch (err) {
        console.error("Close attendance error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const getSessionById = async (req: Request, res: Response) => {
    try {
        if (req.role !== "TEACHER") {
            return res.status(403).json({ message: "Only teachers can get session details" });
        }

        const sessionId = Number(req.params.id);
        if (!sessionId) {
            return res.status(400).json({ message: "Invalid session id" });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { class: true }
        });

        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }

        if (session.class.teacherId !== req.userId) {
            return res.status(403).json({ message: "You are not authorized to view this session" });
        }

        return res.json({
            id: session.id,
            classId: session.classId,
            className: session.class.name,
            date: session.date.toISOString().split("T")[0],
            isAttendanceOpen: session.isAttendanceOpen
        });
    } catch (err) {
        console.error("Get session error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

export const attendance = async (req: Request, res: Response) => {
    try {
        if (req.role !== "TEACHER") {
            return res.status(403).json({ message: "Only teachers can get attendance" });
        }

        const sessionId = Number(req.query.sessionId);
        if (!sessionId) {
            return res.status(400).json({ message: "sessionId is required" });
        }

        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { class: true }
        });
        if (!session) return res.status(404).json({ message: "Session not found" });

        if (session.class.teacherId !== req.userId) {
            return res.status(403).json({ message: "You are not authorized to get attendance" });
        }

        const enrolledStudents = await prisma.enrollment.findMany({
            where: { classId: session.classId },
            select: {
                student: {
                    select: {
                        userId: true,
                        name: true
                    }
                }
            }
        });

        const attendanceRecords = await prisma.attendance.findMany({
            where: {
                sessionId,
            },
            select: {
                studentId: true,
                status: true
            }
        });

        const attendanceList = enrolledStudents.map((enr) => {
            const record = attendanceRecords.find(
                (a) => a.studentId === enr.student.userId
            );
            return {
                userId: enr.student.userId,
                name: enr.student.name,
                status: record ? record.status : "ABSENT" 
            };
        });

        return res.json({
            sessionId: session.id,
            date: session.date.toISOString().split("T")[0],
            attendance: attendanceList
        });
    } catch (err) {
        console.error("Get attendance error:", err);
        return res.status(500).json({ message: "Server error" });
    }
};