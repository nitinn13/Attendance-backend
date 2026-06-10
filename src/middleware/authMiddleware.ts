import { type Request, type Response, type NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { prisma } from '../prisma.js'; 

declare module "express" {
  export interface Request {
    userId?: number;
    role?: string;
  }
}
const jwtSecret = process.env.JWT_SECRET as string;

const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Token not found" });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: "Token not found" });
    }

    if (!jwtSecret) {
      console.error("JWT Secret not set!");
      return res.status(500).json({ message: "Server configuration error" });
    }

    const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
    const user = await prisma.user.findUnique({ where: { userId: decoded.id } });

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized - Invalid user' });
    }

    req.userId = user.userId;
    req.role = user.role;
    next();
  } catch (e) {
    console.error("Token Verification Error:", e);
    return res.status(401).json({ message: "Invalid token" });
  }
};

export default authMiddleware;