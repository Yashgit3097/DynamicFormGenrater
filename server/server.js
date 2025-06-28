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
    numberFields.forEach(label => totals[label] = 0);

    // Load Gujarati font
    const fontPath = path.join(__dirname, "fonts", "NotoSansGujarati-Regular.ttf");
    const fontBytes = fs.readFileSync(fontPath);

    // Create PDF and register fontkit
    const pdfDoc = await PDFDocument.create();
    PDFDocument.prototype.registerFontkit.call(pdfDoc, fontkit); // register fontkit
    const gujaratiFont = await pdfDoc.embedFont(fontBytes);

    let page = pdfDoc.addPage([600, 800]);
    const { width, height } = page.getSize();
    const fontSize = 10;
    const margin = 40;

    page.drawText(`Submissions for ${event.name}`, {
      x: margin,
      y: height - margin - 10,
      size: 16,
      font: gujaratiFont,
      color: rgb(0, 0, 0),
    });

    let y = height - margin - 40;
    const colWidth = (width - margin * 2) / (allFields.length + 1);

    // Headers
    allFields.forEach((label, i) => {
      page.drawText(label, {
        x: margin + i * colWidth,
        y,
        size: fontSize,
        font: gujaratiFont,
      });
    });
    page.drawText("Submitted At", {
      x: margin + allFields.length * colWidth,
      y,
      size: fontSize,
      font: gujaratiFont,
    });
    y -= 20;

    // Table Rows
    for (const sub of submissions) {
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

      allFields.forEach((label, i) => {
        page.drawText(String(row[label] || ""), {
          x: margin + i * colWidth,
          y,
          size: fontSize,
          font: gujaratiFont,
        });
      });
      page.drawText(row.createdAt, {
        x: margin + allFields.length * colWidth,
        y,
        size: fontSize,
        font: gujaratiFont,
      });

      y -= 20;
      if (y < margin + 40) {
        page = pdfDoc.addPage([600, 800]);
        y = height - margin - 40;
      }
    }

    // Totals row
    if (numberFields.length > 0) {
      y -= 10;
      allFields.forEach((label, i) => {
        const val = numberFields.includes(label) ? totals[label] : "";
        page.drawText(String(val), {
          x: margin + i * colWidth,
          y,
          size: fontSize,
          font: gujaratiFont,
        });
      });
      page.drawText("TOTAL", {
        x: margin + allFields.length * colWidth,
        y,
        size: fontSize,
        font: gujaratiFont,
      });
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

    // Font setup
    const fontPath = path.join(__dirname, "fonts", "NotoSansGujarati-Regular.ttf");
    const fontBytes = fs.readFileSync(fontPath);

    const pdfDoc = await PDFDocument.create();
    const fontkit = (await import("fontkit")).default;
    pdfDoc.registerFontkit(fontkit);
    const font = await pdfDoc.embedFont(fontBytes);

    let page = pdfDoc.addPage([800, 1000]);
    const { width, height } = page.getSize();

    const fontSize = 10;
    const margin = 40;
    const lineHeight = fontSize + 4;
    const colCount = allFields.length + 1;
    const colWidth = (width - margin * 2) / colCount;

    let y = height - margin;

    // Helper to wrap text in column
    const wrapText = (text, maxWidth) => {
      const words = String(text || "").split(" ");
      const lines = [];
      let line = "";

      for (const word of words) {
        const test = line + word + " ";
        if (font.widthOfTextAtSize(test, fontSize) > maxWidth) {
          lines.push(line.trim());
          line = word + " ";
        } else {
          line = test;
        }
      }
      if (line) lines.push(line.trim());
      return lines;
    };

    // Title
    y -= 20;
    page.drawText(`Submissions for ${event.name}`, {
      x: margin,
      y,
      size: 16,
      font,
      color: rgb(0, 0, 0),
    });

    y -= 30;

    // Draw table headers
    const headers = [...allFields, "Submitted At"];
    const headerHeight = lineHeight;
    headers.forEach((label, i) => {
      const x = margin + i * colWidth;
      page.drawRectangle({
        x,
        y: y - headerHeight,
        width: colWidth,
        height: headerHeight,
        borderColor: rgb(0, 0, 0),
        borderWidth: 0.5,
      });
      page.drawText(label, {
        x: x + 2,
        y: y - fontSize - 2,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
    });

    y -= headerHeight;

    // Table rows
    for (const sub of submissions) {
      const row = {};
      allFields.forEach(label => {
        const val = sub.data[label];
        row[label] = val ?? "";
        if (numberFields.includes(label)) {
          const num = Number(val);
          if (!isNaN(num)) totals[label] += num;
        }
      });
      row["Submitted At"] = new Date(sub.createdAt).toLocaleString();

      // Wrap all cell values
      const rowValues = [...allFields, "Submitted At"].map(label =>
        wrapText(row[label], colWidth - 4)
      );
      const rowHeight = Math.max(...rowValues.map(v => v.length)) * lineHeight;

      // Page break
      if (y - rowHeight < margin + 30) {
        page = pdfDoc.addPage([800, 1000]);
        y = height - margin;
      }

      // Draw cells with borders and text
      rowValues.forEach((lines, i) => {
        const x = margin + i * colWidth;
        // Draw cell box
        page.drawRectangle({
          x,
          y: y - rowHeight,
          width: colWidth,
          height: rowHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 0.5,
        });

        // Draw wrapped text
        lines.forEach((line, j) => {
          page.drawText(line, {
            x: x + 2,
            y: y - (j + 1) * lineHeight + 4,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
        });
      });

      y -= rowHeight;
    }

    // Totals row
    if (numberFields.length > 0) {
      const totalsRow = allFields.map(label =>
        numberFields.includes(label) ? String(totals[label]) : ""
      );
      totalsRow.push("TOTAL");

      const rowHeight = lineHeight;

      totalsRow.forEach((text, i) => {
        const x = margin + i * colWidth;
        page.drawRectangle({
          x,
          y: y - rowHeight,
          width: colWidth,
          height: rowHeight,
          borderColor: rgb(0, 0, 0),
          borderWidth: 0.5,
        });
        page.drawText(text, {
          x: x + 2,
          y: y - fontSize - 2,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      });

      y -= rowHeight;
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
