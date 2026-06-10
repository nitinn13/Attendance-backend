import express, { type Request, type Response } from "express";
import dotenv from "dotenv";
dotenv.config();
import authRouter from "./routes/auth.js";
import classesRouter from "./routes/class.js";
import adminRouter from "./routes/admin.js";
import teacherRouter from "./routes/teacher.js";
import studentRouter from "./routes/student.js";
import cors from "cors";

const app = express();

// Debug middleware to track ALL headers
// 

app.use(cors({
  origin: true,
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "Origin", "Accept", "X-Requested-With"],
}))

// Express middleware
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.get("/test", (req: Request, res: Response) => {
  res.send("Healthy server");
});

app.use("/auth", authRouter);
app.use("/classes", classesRouter);
app.use("/admin", adminRouter);
app.use("/teacher", teacherRouter);
app.use("/student", studentRouter);

// Debug endpoint to check final headers
app.get("/debug-cors", (req: Request, res: Response) => {
  res.json({ 
    message: "CORS debug",
    headers: {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});