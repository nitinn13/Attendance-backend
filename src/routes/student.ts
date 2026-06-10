import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { markAttendance, studentClasses } from "../controllers/studentController.js";

const studentRouter = express.Router();

studentRouter.get("/my-classes", authMiddleware, studentClasses);
studentRouter.post("/mark-attendance", authMiddleware, markAttendance);

export default studentRouter;