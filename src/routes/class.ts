import express from "express";
import { createClass, allClasses, updateClass, deleteClass } from "../controllers/classController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { allEnrollments, enrollAllStudents, enrollByCsv, enrollMultipleStudents, enrollStudents } from "../controllers/enrollController.js";
import { csvUpload } from "../middleware/csvUpload.js";

const classesRouter = express.Router();

classesRouter.post("/create", authMiddleware, createClass);
classesRouter.get("/allClasses", authMiddleware, allClasses);
classesRouter.put("/:id", authMiddleware, updateClass);
classesRouter.delete("/:id", authMiddleware, deleteClass);
classesRouter.post("/enroll-students", authMiddleware, enrollStudents);
classesRouter.post("/enroll-multiple-students", authMiddleware, enrollMultipleStudents);
classesRouter.post("/enroll-all-students", authMiddleware, enrollAllStudents);
classesRouter.get("/all-enrollments", authMiddleware, allEnrollments);
classesRouter.post("/enroll-csv", authMiddleware, csvUpload.single("file"), enrollByCsv);

export default classesRouter;