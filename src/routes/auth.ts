import express from "express";
import { register, login, logout } from "../controllers/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const authRouter = express.Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/delete-device", authMiddleware ,logout);

export default authRouter;