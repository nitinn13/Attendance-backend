import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { type Request, type Response } from "express";
import z from "zod";
import { prisma } from "../prisma.js";
import { generateResetCode, sendPasswordResetEmail } from "../services/emailService.js";

const jwtSecret = process.env.JWT_SECRET as string;


// Register (college-side)
export const register = async (
    req: Request,
    res: Response
) => {
    try {
        const userSchema = z.object({
            name: z.string().min(2),
            email: z.string().email(),
            password: z.string().min(6),
            university: z.string().optional(),
            role: z.enum([
                "ADMIN",
                "TEACHER",
                "STUDENT"
            ])
        });

        const result =
            userSchema.safeParse(req.body);

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
            email,
            password,
            role,
            university
        } = result.data;

        const existingUser =
            await prisma.user.findUnique({
                where: {
                    email
                }
            });

        if (existingUser) {
            return res.status(400).json({
                message:
                    "User already exists"
            });
        }

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );

        const newUser =
            await prisma.user.create({
                data: {
                    name,
                    email,
                    password:
                        hashedPassword,
                    university: university ?? null,
                    role:
                        role ||
                        "STUDENT"
                }
            });

        res.status(200).json({
            message:
                "User registered successfully",
            newUser: {
                userId:
                    newUser.userId,
                name:
                    newUser.name,
                email:
                    newUser.email,
                university:
                    newUser.university,
                role:
                    newUser.role
            }
        });
    } catch (err) {
        console.error(
            "Register error:",
            err
        );

        res.status(500).json({
            message:
                "Server error"
        });
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


export const logoutAllUsers = async (
    req: Request,
    res: Response
) => {
    try {
        if (req.role !== "ADMIN") {
            return res.status(403).json({
                message:
                    "Only admin can reset devices",
            });
        }


        const result = await prisma.user.updateMany({
            where: {
                role: "STUDENT"
            },
            data: {
                uuid: null
            }
        });

        return res.status(200).json({
            message:
                "All user devices reset successfully",
            usersUpdated: result.count,
        });
    } catch (err) {
        console.error(
            "Reset all devices error:",
            err
        );

        return res.status(500).json({
            message: "Server error",
        });
    }
};


export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const emailSchema = z.object({
            email: z.string().email(),
        });

        const result = emailSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ message: "Invalid email format" });
        }

        const { email } = result.data;

        // Check if user exists
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            // Don't reveal that user doesn't exist (security)
            return res.status(200).json({
                message: "If an account exists with this email, you will receive a reset code.",
            });
        }

        // Generate reset code
        const resetCode = generateResetCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Delete any existing unused tokens for this user
        await prisma.passwordResetToken.deleteMany({
            where: {
                userId: user.userId,
                used: false,
            },
        });

        // Create new reset token
        await prisma.passwordResetToken.create({
            data: {
                email: user.email,
                userId: user.userId,
                token: resetCode,
                expiresAt,
                used: false,
            },
        });

        // Send email with reset code
        await sendPasswordResetEmail(email, resetCode);

        res.status(200).json({
            message: "If an account exists with this email, you will receive a reset code.",
        });
    } catch (err) {
        console.error("Forgot password error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Verify Reset Code
export const verifyResetCode = async (req: Request, res: Response) => {
    try {
        const verifySchema = z.object({
            email: z.string().email(),
            code: z.string().length(6),
        });

        const result = verifySchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ message: "Invalid input" });
        }

        const { email, code } = result.data;

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(400).json({
                message: "Invalid or expired reset code",
            });
        }

        // Find the token
        const tokenRecord = await prisma.passwordResetToken.findFirst({
            where: {
                userId: user.userId,
                token: code,
                used: false,
                expiresAt: {
                    gt: new Date(),
                },
            },
        });

        if (!tokenRecord) {
            return res.status(400).json({
                message: "Invalid or expired reset code",
            });
        }

        // Return success - code is valid
        res.status(200).json({
            message: "Code verified successfully",
            valid: true,
        });
    } catch (err) {
        console.error("Verify reset code error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// Reset Password - Set new password
export const resetPassword = async (req: Request, res: Response) => {
    try {
        const resetSchema = z.object({
            email: z.string().email(),
            code: z.string().length(6),
            newPassword: z.string().min(6),
        });

        const result = resetSchema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({ message: "Invalid input" });
        }

        const { email, code, newPassword } = result.data;

        // Find user by email
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(400).json({
                message: "Invalid or expired reset code",
            });
        }

        // Find the token
        const tokenRecord = await prisma.passwordResetToken.findFirst({
            where: {
                userId: user.userId,
                token: code,
                used: false,
                expiresAt: {
                    gt: new Date(),
                },
            },
        });

        if (!tokenRecord) {
            return res.status(400).json({
                message: "Invalid or expired reset code",
            });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password
        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword, uuid: null },
        });

        // Mark the token as used
        await prisma.passwordResetToken.update({
            where: { id: tokenRecord.id },
            data: { used: true },
        });

        // Delete all other unused tokens for this user (security)
        await prisma.passwordResetToken.deleteMany({
            where: {
                userId: user.userId,
                used: false,
            },
        });

        res.status(200).json({
            message: "Password reset successful. You can now login with your new password.",
        });
    } catch (err) {
        console.error("Reset password error:", err);
        res.status(500).json({ message: "Server error" });
    }
};