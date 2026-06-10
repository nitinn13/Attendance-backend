import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { attendance, closeAttendance, myClasses, openAttendance } from "../controllers/teacherController.js";

const teacherRouter = express.Router();

teacherRouter.get("/my-classes", authMiddleware, myClasses);
teacherRouter.post("/open-attendance", authMiddleware, openAttendance);
teacherRouter.post("/close-attendance", authMiddleware, closeAttendance);
teacherRouter.get("/attendance", authMiddleware, attendance);

export default teacherRouter;
