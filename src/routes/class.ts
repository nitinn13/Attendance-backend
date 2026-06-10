import express from "express";
import { createClass, allClasses } from "../controllers/classController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { allEnrollments, enrollAllStudents, enrollStudents } from "../controllers/enrollController.js";


const classesRouter = express.Router();

classesRouter.post("/create", authMiddleware, createClass);
classesRouter.get("/allClasses", authMiddleware, allClasses);
classesRouter.post("/enroll-students", authMiddleware, enrollStudents);
classesRouter.post("/enroll-all-students", authMiddleware, enrollAllStudents);
classesRouter.get("/all-enrollments", authMiddleware, allEnrollments);



export default classesRouter;