import { type Request, type Response } from "express";
import z from "zod";
import { prisma } from "../prisma.js";

export const createClass = async (
    req: Request,
    res: Response
) => {
    if (req.role !== "ADMIN") {
        return res.status(400).json({
            message: "Only admin can create class"
        });
    }

    try {
        const classSchema = z.object({
            name: z.string().min(2),
            teacherId: z.number(),
            classDate: z.string()
        });

        const result = classSchema.safeParse(req.body);

        if (!result.success) {
            console.log(
                "Validation Error:",
                result.error.format()
            );

            return res.status(400).json({
                message: "Invalid input"
            });
        }

        const {
            name,
            teacherId,
            classDate
        } = result.data;

        const teacher =
            await prisma.user.findUnique({
                where: {
                    userId: teacherId
                }
            });

        if (!teacher) {
            return res.status(400).json({
                message: "Teacher not found"
            });
        }

        const newClass =
            await prisma.class.create({
                data: {
                    name,
                    teacherId,
                    classDate: new Date(classDate)
                }
            });

        res.status(200).json({
            message:
                "Class created successfully",
            newClass: {
                id: newClass.id,
                name: newClass.name,
                classDate:
                    newClass.classDate
                        ?.toISOString()
                        .split("T")[0],
                isAttendanceOpen:
                    newClass.isAttendanceOpen,
                teacherId:
                    newClass.teacherId
            }
        });
    } catch (err) {
        console.error(
            "Create class error:",
            err
        );

        res.status(500).json({
            message: "Server error"
        });
    }
};

export const allClasses = async (req: Request, res: Response) => {
    if (req.role != "ADMIN") {
        return res.status(400).json({ message: "Only admin can get classes" });
    }
    try {
        const classes = await prisma.class.findMany({
            include: { teacher: true, enrollments: true }
        });

        res.json(classes);
    } catch (err) {
        console.error("Get classes error:", err);
        res.status(500).json({ message: "Server error" });
    }
};