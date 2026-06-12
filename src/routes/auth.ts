import express from "express";
import { register, login, logout, logoutAllUsers } from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const authRouter = express.Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/delete-device", authMiddleware ,logout);
authRouter.post("/delete-alldevices", authMiddleware, logoutAllUsers)

export default authRouter;