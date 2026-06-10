import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { type Request, type Response } from "express";
import z from "zod";
import { prisma } from "../prisma.js";

const jwtSecret = process.env.JWT_SECRET as string;


// Register (college-side)
export const register = async (req: Request, res: Response) => {
    try {
        const userSchema = z.object({
            name: z.string().min(2),
            email: z.string().email(),
            password: z.string().min(6),
            role: z.enum(["ADMIN", "TEACHER", "STUDENT"])
        });
        const result = userSchema.safeParse(req.body);
        if (!result.success) {
            console.log("Validation Error:", result);
            return res.status(400).json({ message: "Invalid input" });
        }

        const { name, email, password, role } = result.data;


        const existingUSer = await prisma.user.findUnique({
            where: {
                email: email
            }
        });
        if (existingUSer) return res.status(400).json({ message: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: role || "STUDENT"
            }
        });


        res.status(200).json({
            message: "User registered successfully",
            newUser: {
                userId: newUser.userId,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (err) {
        console.error("Register error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Login (assign uuid)
export const login = async (req: Request, res: Response) => {
    try {
        const { email, password, uuid } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const newUuid = uuidv4();
        let storedUuid = user.uuid;

        if (user.role === "STUDENT") {
            if (!storedUuid) {
                storedUuid = newUuid;
                await prisma.user.update({
                    where: { email: user.email },
                    data: { uuid: newUuid },
                });
            } else {
                if (uuid !== storedUuid) {
                    return res.status(400).json({ message: "Login only allowed from the original device" });
                }
            }
        }

        const token = jwt.sign(
            { id: user.userId, role: user.role },
            jwtSecret,
            { expiresIn: "7d" }
        );

        res.json({
            message: "Login successful",
            user: {
                userId: user.userId,
                name: user.name,
                email: user.email,
                role: user.role,
                uuid: storedUuid // ✅ use storedUuid here
            },
            token
        });

    } catch (err) {
        console.error("Login error:", err);
        res.status(500).json({ message: "Server error" });
    }
};


export const logout = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        const { role } = req;
        console.log(role)
        if (role != "ADMIN") {
            return res.status(400).json({ message: "Only admin can delete device" });
        }

        const user = await prisma.user.findUnique({
            where: {
                email
            }
        });
        if (!user) return res.status(400).json({ message: "User not found" });

        const updatedUser = await prisma.user.update({
            where: {
                email: user.email
            },
            data: {
                uuid: null
            }
        })

        res.json({
            message: "Device deleted successfully",
            user: {
                userId: updatedUser.userId,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role
            }
        });
    } catch (err) {
        console.error("Delete sync error:", err);
        res.status(500).json({ message: "Server error" });
    }
};