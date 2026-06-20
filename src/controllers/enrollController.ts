import { type Request, type Response } from "express";
import z from "zod";
import { prisma } from "../prisma.js";

// Express.Multer.File is added to Request by the `multer` middleware
// (see csvUpload.ts). req.file is only present on routes that use it.


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

export const enrollMultipleStudents = async (req: Request, res: Response) => {
    if (req.role !== "ADMIN") {
        return res.status(403).json({
            message: "Only admin can enroll students"
        });
    }

    try {
        const schema = z.object({
            classId: z.number(),
            studentIds: z.array(z.number()).min(1)
        });

        const result = schema.safeParse(req.body);

        if (!result.success) {
            console.log("Validation Error:", result.error.format());
            return res.status(400).json({
                message: "Invalid input"
            });
        }

        const { classId, studentIds } = result.data;

        // Check class exists
        const class_ = await prisma.class.findUnique({
            where: { id: classId }
        });

        if (!class_) {
            return res.status(404).json({
                message: "Class not found"
            });
        }

        // Get valid students
        const students = await prisma.user.findMany({
            where: {
                userId: {
                    in: studentIds
                },
                role: "STUDENT"
            },
            select: {
                userId: true
            }
        });

        if (students.length === 0) {
            return res.status(400).json({
                message: "No valid students found"
            });
        }

        const validStudentIds = students.map(s => s.userId);

        // Find already enrolled students
        const existingEnrollments = await prisma.enrollment.findMany({
            where: {
                classId,
                studentId: {
                    in: validStudentIds
                }
            },
            select: {
                studentId: true
            }
        });

        const enrolledIds = new Set(
            existingEnrollments.map(e => e.studentId)
        );

        // Students that need enrollment
        const studentsToEnroll = validStudentIds.filter(
            id => !enrolledIds.has(id)
        );

        if (studentsToEnroll.length === 0) {
            return res.status(400).json({
                message: "All selected students are already enrolled"
            });
        }

        const created = await prisma.enrollment.createMany({
            data: studentsToEnroll.map(studentId => ({
                classId,
                studentId
            })),
            skipDuplicates: true
        });

        return res.status(200).json({
            message: "Students enrolled successfully",
            requested: studentIds.length,
            validStudents: validStudentIds.length,
            newlyEnrolled: created.count,
            skipped: validStudentIds.length - created.count
        });

    } catch (err) {
        console.error("Enroll multiple students error:", err);
        return res.status(500).json({
            message: "Server error"
        });
    }
};


export const enrollByCsv = async (req: Request, res: Response) => {
    if (req.role !== "ADMIN") {
        return res.status(403).json({
            message: "Only admin can enroll students"
        });
    }

    try {
        const classIdRaw = req.body?.classId;
        const classId = Number(classIdRaw);

        if (!classIdRaw || Number.isNaN(classId)) {
            return res.status(400).json({
                message: "Invalid or missing classId"
            });
        }

        if (!req.file) {
            return res.status(400).json({
                message: "CSV file is required"
            });
        }

        // Check class exists
        const class_ = await prisma.class.findUnique({
            where: { id: classId }
        });

        if (!class_) {
            return res.status(404).json({
                message: "Class not found"
            });
        }

        // Parse CSV buffer -> list of emails
        const csvText = req.file.buffer.toString("utf-8");
        const rawLines = csvText
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (rawLines.length === 0) {
            return res.status(400).json({
                message: "CSV file is empty"
            });
        }

        // Support a header row (e.g. "email") or no header at all.
        // If the first cell of the first line isn't a valid-looking
        // email, treat that line as a header and skip it.
        const emailLooksValid = (value: string) =>
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

        // const firstCell = rawLines[0].split(",")[0].trim();
        const firstCell =
            rawLines[0]
                ?.split(",")[0]
                ?.trim() ?? "";
        const dataLines = emailLooksValid(firstCell)
            ? rawLines
            : rawLines.slice(1);

        // Extract first column as email, dedupe (case-insensitive)
        const emailsInFile: string[] = [];
        const seen = new Set<string>();

        for (const line of dataLines) {
            const cell = line.split(",")[0]?.trim();
            if (!cell) continue;

            const normalized = cell.toLowerCase();
            if (seen.has(normalized)) continue;
            seen.add(normalized);
            emailsInFile.push(cell);
        }

        if (emailsInFile.length === 0) {
            return res.status(400).json({
                message: "No valid email addresses found in CSV"
            });
        }

        // Look up matching users
        const normalizedEmails = emailsInFile.map(e => e.toLowerCase());

        const matchedUsers = await prisma.user.findMany({
            where: {
                email: { in: normalizedEmails },
            },
            select: {
                userId: true,
                email: true,
                role: true,
            }
        });

        const matchedByEmail = new Map(
            matchedUsers.map(u => [u.email.toLowerCase(), u])
        );

        const notFound: string[] = [];
        const wrongRole: string[] = [];
        const validUsers: { userId: number; email: string }[] = [];

        for (const email of emailsInFile) {
            const match = matchedByEmail.get(email.toLowerCase());

            if (!match) {
                notFound.push(email);
                continue;
            }

            if (match.role !== "STUDENT") {
                wrongRole.push(email);
                continue;
            }

            validUsers.push({ userId: match.userId, email: match.email });
        }

        if (validUsers.length === 0) {
            return res.status(400).json({
                message: "No valid students found in CSV",
                notFound,
                wrongRole
            });
        }

        // Find already enrolled among the valid set
        const existingEnrollments = await prisma.enrollment.findMany({
            where: {
                classId,
                studentId: { in: validUsers.map(u => u.userId) }
            },
            select: { studentId: true }
        });

        const alreadyEnrolledIds = new Set(
            existingEnrollments.map(e => e.studentId)
        );

        const toEnroll = validUsers.filter(
            u => !alreadyEnrolledIds.has(u.userId)
        );

        const alreadyEnrolledEmails = validUsers
            .filter(u => alreadyEnrolledIds.has(u.userId))
            .map(u => u.email);

        if (toEnroll.length === 0) {
            return res.status(400).json({
                message: "All matched students are already enrolled in this class",
                alreadyEnrolled: alreadyEnrolledEmails,
                notFound,
                wrongRole
            });
        }

        const created = await prisma.enrollment.createMany({
            data: toEnroll.map(u => ({
                classId,
                studentId: u.userId
            })),
            skipDuplicates: true
        });

        return res.status(200).json({
            message: "Students enrolled successfully from CSV",
            totalRowsInFile: emailsInFile.length,
            newlyEnrolled: created.count,
            alreadyEnrolled: alreadyEnrolledEmails,
            notFound,
            wrongRole
        });
    } catch (err) {
        console.error("Enroll by CSV error:", err);
        return res.status(500).json({
            message: "Server error"
        });
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