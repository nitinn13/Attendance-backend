import { type Request, type Response } from "express";
import z from "zod";
import { prisma } from "../prisma.js";

const WEEKDAYS = [
    "SUNDAY",
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
] as const;

function buildSessionDates(
    startDate: Date,
    endDate: Date,
    recurrenceDays: string[]
): Date[] {
    const allowedIndexes = new Set(
        recurrenceDays.map(day => WEEKDAYS.indexOf(day as any))
    );

    const dates: Date[] = [];

    const cursor = new Date(
        Date.UTC(
            startDate.getUTCFullYear(),
            startDate.getUTCMonth(),
            startDate.getUTCDate()
        )
    );
    const end = new Date(
        Date.UTC(
            endDate.getUTCFullYear(),
            endDate.getUTCMonth(),
            endDate.getUTCDate()
        )
    );

    while (cursor <= end) {
        if (allowedIndexes.has(cursor.getUTCDay())) {
            dates.push(new Date(cursor));
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return dates;
}

export const createClass = async (req: Request, res: Response) => {
    if (req.role !== "ADMIN") {
        return res.status(400).json({ message: "Only admin can create class" });
    }

    try {
        const classSchema = z.object({
            name: z.string().min(2),
            teacherId: z.number(),
            recurrenceDays: z.array(z.enum(WEEKDAYS)).min(1, "Select at least one weekday"),
            startDate: z.string(),
            endDate: z.string()
        });

        const result = classSchema.safeParse(req.body);
        if (!result.success) {
            console.log("Validation Error:", result.error.format());
            return res.status(400).json({ message: "Invalid input" });
        }

        const { name, teacherId, recurrenceDays, startDate, endDate } = result.data;

        const parsedStart = new Date(startDate);
        const parsedEnd = new Date(endDate);

        if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
            return res.status(400).json({ message: "Invalid startDate or endDate" });
        }

        if (parsedEnd < parsedStart) {
            return res.status(400).json({ message: "endDate must be on or after startDate" });
        }

        const teacher = await prisma.user.findUnique({ where: { userId: teacherId } });
        if (!teacher) return res.status(400).json({ message: "Teacher not found" });
        if (teacher.role !== "TEACHER") return res.status(400).json({ message: "Selected user is not a teacher" });

        const sessionDates = buildSessionDates(parsedStart, parsedEnd, recurrenceDays);
        if (sessionDates.length === 0) {
            return res.status(400).json({
                message: "No sessions fall within the given date range for the selected weekdays"
            });
        }

        const newClass = await prisma.$transaction(async (tx) => {
            const created = await tx.class.create({
                data: { name, teacherId, recurrenceDays, startDate: parsedStart, endDate: parsedEnd }
            });
            await tx.session.createMany({
                data: sessionDates.map(date => ({ classId: created.id, date }))
            });
            return created;
        });

        res.status(200).json({
            message: "Class created successfully",
            newClass: {
                id: newClass.id,
                name: newClass.name,
                teacherId: newClass.teacherId,
                recurrenceDays: newClass.recurrenceDays,
                startDate: newClass.startDate.toISOString().split("T")[0],
                endDate: newClass.endDate.toISOString().split("T")[0],
                sessionsCreated: sessionDates.length
            }
        });
    } catch (err) {
        console.error("Create class error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const updateClass = async (req: Request, res: Response) => {
    if (req.role !== "ADMIN") {
        return res.status(403).json({ message: "Only admin can update a class" });
    }

    try {
        const classId = Number(req.params.id);
        if (!classId) return res.status(400).json({ message: "Invalid class id" });

        const schema = z.object({
            name: z.string().min(2),
            teacherId: z.number(),
            recurrenceDays: z.array(z.enum(WEEKDAYS)).min(1, "Select at least one weekday"),
            startDate: z.string(),
            endDate: z.string()
        });

        const result = schema.safeParse(req.body);
        if (!result.success) {
            console.log("Validation Error:", result.error.format());
            return res.status(400).json({ message: "Invalid input" });
        }

        const { name, teacherId, recurrenceDays, startDate, endDate } = result.data;

        const parsedStart = new Date(startDate);
        const parsedEnd = new Date(endDate);

        if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
            return res.status(400).json({ message: "Invalid startDate or endDate" });
        }

        if (parsedEnd < parsedStart) {
            return res.status(400).json({ message: "endDate must be on or after startDate" });
        }

        const existing = await prisma.class.findUnique({ where: { id: classId } });
        if (!existing) return res.status(404).json({ message: "Class not found" });

        const teacher = await prisma.user.findUnique({ where: { userId: teacherId } });
        if (!teacher) return res.status(400).json({ message: "Teacher not found" });
        if (teacher.role !== "TEACHER") return res.status(400).json({ message: "Selected user is not a teacher" });

        const sessionDates = buildSessionDates(parsedStart, parsedEnd, recurrenceDays);
        if (sessionDates.length === 0) {
            return res.status(400).json({
                message: "No sessions fall within the given date range for the selected weekdays"
            });
        }

        // Update class fields and regenerate sessions in one transaction.
        // Deleting sessions cascades to their Attendance records (onDelete: Cascade
        // on Session → Attendance defined in schema.prisma).
        const updatedClass = await prisma.$transaction(async (tx) => {
            const updated = await tx.class.update({
                where: { id: classId },
                data: { name, teacherId, recurrenceDays, startDate: parsedStart, endDate: parsedEnd }
            });

            // Wipe old sessions — cascades to attendance records automatically.
            await tx.session.deleteMany({ where: { classId } });

            // Recreate sessions for the new schedule.
            await tx.session.createMany({
                data: sessionDates.map(date => ({ classId, date }))
            });

            return updated;
        });

        res.status(200).json({
            message: "Class updated successfully",
            updatedClass: {
                id: updatedClass.id,
                name: updatedClass.name,
                teacherId: updatedClass.teacherId,
                recurrenceDays: updatedClass.recurrenceDays,
                startDate: updatedClass.startDate.toISOString().split("T")[0],
                endDate: updatedClass.endDate.toISOString().split("T")[0],
                sessionsRecreated: sessionDates.length
            }
        });
    } catch (err) {
        console.error("Update class error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const deleteClass = async (req: Request, res: Response) => {
    if (req.role !== "ADMIN") {
        return res.status(403).json({ message: "Only admin can delete a class" });
    }

    try {
        const classId = Number(req.params.id);
        if (!classId) return res.status(400).json({ message: "Invalid class id" });

        const existing = await prisma.class.findUnique({ where: { id: classId } });
        if (!existing) return res.status(404).json({ message: "Class not found" });

        // onDelete: Cascade in schema.prisma handles:
        //   Class → Session → Attendance (two-level cascade)
        //   Class → Enrollment
        await prisma.class.delete({ where: { id: classId } });

        res.status(200).json({
            message: "Class deleted successfully",
            deletedClassId: classId
        });
    } catch (err) {
        console.error("Delete class error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

export const allClasses = async (req: Request, res: Response) => {
    if (req.role != "ADMIN") {
        return res.status(400).json({ message: "Only admin can get classes" });
    }
    try {
        const classes = await prisma.class.findMany({
            include: {
                teacher: true,
                enrollments: true,
                sessions: { orderBy: { date: "asc" } }
            }
        });

        res.json(classes);
    } catch (err) {
        console.error("Get classes error:", err);
        res.status(500).json({ message: "Server error" });
    }
};