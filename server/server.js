import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cron from "node-cron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// For PDF generation
import { PDFDocument, rgb } from "pdf-lib";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fontkit = require("fontkit"); // ✅ Required for custom fonts

// Your models and CSV writer
import { Event, Submission } from "./models.js";
import { createObjectCsvWriter } from "csv-writer";


const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Local
mongoose.connect("mongodb+srv://yashgithub907:Y%40sh%403097@dynamicformgenrator.00uobzb.mongodb.net/?retryWrites=true&w=majority&appName=DynamicFormGenrator")
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.error(err));

const JWT_SECRET = "mysecretkey";
const ADMIN_EMAIL = "admin@admin.com";
const ADMIN_PASSWORD = "admin@1234"; // plain text for demo

// Login route
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });
    return res.json({ token });
  }
  return res.status(401).json({ message: "Invalid credentials" });
});

// Middleware for auth
const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).send("Unauthorized");
  const token = header.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).send("Invalid Token");
    req.user = user;
    next();
  });
};

// Create event
app.post("/api/events", auth, async (req, res) => {
  const { name, description, fields, expiresAt } = req.body;
  const event = new Event({ name, description, fields, expiresAt });
  await event.save();
  res.json(event);
});
app.get("/api/verify-token", auth, async (req, res) => {
  try {
    // If the auth middleware passed, the token is valid
    res.json({ 
      isValid: true,
      user: req.user,
      message: "Token is valid"
    });
  } catch (err) {
    res.status(500).json({ 
      isValid: false,
      message: "Error verifying token"
    });
  }
});
// Get all events
app.get("/api/events", auth, async (req, res) => {
  const events = await Event.find();
  res.json(events);
});

// Get single event by ID
app.get("/api/events/:id", async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).send("Event not found");
  if (new Date() > new Date(event.expiresAt)) {
    return res.status(410).send("Link expired");
  }
  res.json(event);
});

// Delete multiple submissions
app.delete("/api/submissions", auth, async (req, res) => {
  try {
    const { submissionIds } = req.body;
    
    if (!submissionIds || !Array.isArray(submissionIds)) {
      return res.status(400).send("Invalid submission IDs");
    }

    const result = await Submission.deleteMany({ 
      _id: { $in: submissionIds } 
    });

    if (result.deletedCount === 0) {
      return res.status(404).send("No submissions found to delete");
    }

    res.send({
      message: `${result.deletedCount} submission(s) deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error("Error deleting submissions:", err);
    res.status(500).send("Server error");
  }
});



// Submit form
app.post("/api/events/:id/submit", async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).send("Event not found");
  if (new Date() > new Date(event.expiresAt)) {
    return res.status(410).send("Link expired");
  }
  const submission = new Submission({
    eventId: event._id,
    data: req.body,
  });
  await submission.save();
  res.json(submission);
});
app.get("/api/events/:id/download", auth, async (req, res) => {
  try {
    const submissions = await Submission.find({ eventId: req.params.id });
    const event = await Event.findById(req.params.id);

    if (!event) return res.status(404).send("Event not found");
    if (!submissions?.length) return res.status(404).send("No submissions found");

    // Get all field labels and detect number fields (even if not properly typed)
    const allFields = event.fields.map(f => f.label);
    const numberFields = event.fields
      .filter(f => f.type === "number" || f.type === "Number" || /^\d+$/.test(submissions[0]?.data[f.label]?.toString()))
      .map(f => f.label);

    console.log("Auto-detected number fields:", numberFields); // This should now include 'sankhya'

    // CSV Headers
    const headers = [
      ...allFields.map(label => ({ id: label, title: label })),
      { id: "createdAt", title: "Submitted At" },
    ];

    // Initialize totals
    const totals = {};
    numberFields.forEach(label => (totals[label] = 0));

    // Process submissions
    const records = submissions.map(sub => {
      const record = {};
      allFields.forEach(label => {
        const val = sub.data[label];
        record[label] = val ?? "";

        if (numberFields.includes(label)) {
          const num = Number(val);
          if (!isNaN(num)) totals[label] += num;
        }
      });
      record.createdAt = new Date(sub.createdAt).toLocaleString();
      return record;
    });

    // Add total row if we found any number fields
    if (numberFields.length > 0) {
      const totalRow = Object.fromEntries(
        allFields.map(label => [
          label, 
          numberFields.includes(label) ? totals[label] : ""
        ])
      );
      totalRow.createdAt = "TOTAL";
      records.push(totalRow);
    }

    // Generate CSV
    const csvWriter = createObjectCsvWriter({
      path: "submissions.csv",
      header: headers,
    });
    await csvWriter.writeRecords(records);

    res.download("submissions.csv", `submissions_${event._id}.csv`, (err) => {
      fs.unlink("submissions.csv", () => {});
      if (err) console.error("Download failed:", err);
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).send("Server error");
  }
});

// Get submissions for an event
app.get("/api/events/:id/submissions", auth, async (req, res) => {
  const submissions = await Submission.find({ eventId: req.params.id });
  res.json(submissions);
});

// Delete event & submissions
app.delete("/api/events/:id", auth, async (req, res) => {
  await Submission.deleteMany({ eventId: req.params.id });
  await Event.findByIdAndDelete(req.params.id);
  res.send("Deleted");
});

// Live view route - returns JSON data for tabular display
app.get("/api/events/:id/live-view", auth, async (req, res) => {
  try {
    const submissions = await Submission.find({ eventId: req.params.id });
    const event = await Event.findById(req.params.id);

    if (!event) return res.status(404).send("Event not found");
    if (!submissions?.length) return res.status(404).send("No submissions found");

    // Get all field labels and detect number fields
    const allFields = event.fields.map(f => f.label);
    const numberFields = event.fields
      .filter(f => f.type === "number" || f.type === "Number")
      .map(f => f.label);

    // Initialize totals
    const totals = {};
    numberFields.forEach(label => (totals[label] = 0));

    // Prepare data and calculate totals
    const rows = submissions.map(sub => {
      const row = {};
      allFields.forEach(label => {
        const val = sub.data[label];
        row[label] = val ?? "";

        if (numberFields.includes(label)) {
          const num = Number(val);
          if (!isNaN(num)) totals[label] += num;
        }
      });
      row.createdAt = new Date(sub.createdAt).toLocaleString();
      return row;
    });

    // Prepare response
    const response = {
      eventName: event.name,
      fields: allFields,
      numberFields,
      submissions: rows,
      totals: numberFields.length > 0 ? totals : null,
      lastUpdated: new Date().toISOString()
    };

    res.json(response);

  } catch (err) {
    console.error("Error generating live view:", err);
    res.status(500).send("Error generating live view");
  }
});

app.get("/api/events/:id/download-pdf", auth, async (req, res) => {
  try {
    const submissions = await Submission.find({ eventId: req.params.id });
    const event = await Event.findById(req.params.id);

    if (!event) return res.status(404).send("Event not found");
    if (!submissions?.length) return res.status(404).send("No submissions found");

    const allFields = event.fields.map(f => f.label);
    const numberFields = event.fields
      .filter(f => f.type.toLowerCase() === "number" || /^\d+$/.test(submissions[0]?.data[f.label]?.toString()))
      .map(f => f.label);

    const totals = {};
    numberFields.forEach(label => (totals[label] = 0));

    const fontPath = path.join(__dirname, "fonts", "NotoSansGujarati-Regular.ttf");
    const fontBytes = fs.readFileSync(fontPath);

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(fontBytes);

    let page = pdfDoc.addPage([900, 1200]);
    const { width, height } = page.getSize();
    const margin = 40;
    const fontSize = 10;
    const lineHeight = fontSize + 4;

    const wrapText = (text, maxWidth) => {
      const words = String(text || "").split(" ");
      const lines = [];
      let line = "";
      for (const word of words) {
        const testLine = line + word + " ";
        if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth) {
          lines.push(line.trim());
          line = word + " ";
        } else {
          line = testLine;
        }
      }
      if (line) lines.push(line.trim());
      return lines;
    };

    let y = height - margin;
    page.drawText(`Submissions for ${event.name}`, {
      x: margin,
      y: y - 10,
      size: 16,
      font,
      color: rgb(0, 0, 0),
    });

    y -= 40;

    const columns = [...allFields, "Submitted At"];
    const colWidth = (width - margin * 2) / columns.length;

    const drawRow = (rowValues, yStart) => {
      const maxLines = Math.max(...rowValues.map(val => wrapText(val, colWidth - 6).length));
      const rowHeight = maxLines * lineHeight + 4;

      columns.forEach((key, i) => {
        const x = margin + i * colWidth;
        const textLines = wrapText(rowValues[i], colWidth - 6);

        // Cell rectangle
        page.drawRectangle({
          x,
          y: yStart - rowHeight,
          width: colWidth,
          height: rowHeight,
          borderWidth: 0.5,
          borderColor: rgb(0, 0, 0),
        });

        // Draw wrapped text
        textLines.forEach((line, lineIndex) => {
          page.drawText(line, {
            x: x + 3,
            y: yStart - (lineIndex + 1) * lineHeight - 2,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
        });
      });

      return rowHeight;
    };

    // Draw table header
    const headerHeight = drawRow(columns, y);
    y -= headerHeight;

    // Draw rows
    for (const sub of submissions) {
      const row = [];
      allFields.forEach(label => {
        const val = sub.data[label] ?? "";
        row.push(val);
        if (numberFields.includes(label)) {
          const num = Number(val);
          if (!isNaN(num)) totals[label] += num;
        }
      });
      row.push(new Date(sub.createdAt).toLocaleString());

      const rowHeight = drawRow(row, y);
      y -= rowHeight;

      if (y < margin + 100) {
        page = pdfDoc.addPage([900, 1200]);
        y = height - margin;
      }
    }

    // Draw total row
    if (numberFields.length > 0) {
      const totalRow = allFields.map(label => numberFields.includes(label) ? totals[label].toString() : "");
      totalRow.push("TOTAL");
      drawRow(totalRow, y);
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="submissions_${event._id}.pdf"`);
    res.send(Buffer.from(pdfBytes));

  } catch (err) {
    console.error("Error generating PDF:", err);
    res.status(500).send("Error generating PDF");
  }
});






// Cron job: Delete expired events + submissions after 2 days
cron.schedule("0 0 * * *", async () => {
  console.log("⏰ Running daily cleanup");
  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  const expired = await Event.find({ expiresAt: { $lte: twoDaysAgo } });
  for (const e of expired) {
    await Submission.deleteMany({ eventId: e._id });
    await Event.findByIdAndDelete(e._id);
    console.log(`Deleted expired event ${e._id}`);
  }
});

app.listen(4000, () => console.log("🚀 Server running on http://localhost:4000"));
