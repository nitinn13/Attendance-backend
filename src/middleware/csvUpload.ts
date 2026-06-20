import multer from "multer";

// In-memory storage — we only need the buffer to parse the CSV,
// no need to persist the file to disk.
const storage = multer.memoryStorage();

function csvFileFilter(
    _req: any,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
) {
    const isCsv =
        file.mimetype === "text/csv" ||
        file.mimetype === "application/vnd.ms-excel" ||
        file.originalname.toLowerCase().endsWith(".csv");

    if (!isCsv) {
        return cb(new Error("Only .csv files are allowed"));
    }

    cb(null, true);
}

export const csvUpload = multer({
    storage,
    fileFilter: csvFileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB is plenty for an email list
    },
});