import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import { allStudents, allTeachers } from "../controllers/adminControllers.js";

const adminRouter = express.Router();


adminRouter.get("/all-students", authMiddleware, allStudents);
adminRouter.get("/all-teachers", authMiddleware, allTeachers);


export default adminRouter;