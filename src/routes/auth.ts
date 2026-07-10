import express from "express";
import { register, login, logout, logoutAllUsers, forgotPassword, verifyResetCode, resetPassword } from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const authRouter = express.Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/delete-device", authMiddleware ,logout);
authRouter.post("/delete-alldevices", authMiddleware, logoutAllUsers)
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/verify-reset-code", verifyResetCode);
authRouter.post("/reset-password", resetPassword);

export default authRouter;