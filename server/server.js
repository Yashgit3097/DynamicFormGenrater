// const { PDFDocument, rgb } = require("pdf-lib");
// const path = require("path");
import {PDFDocument, rgb} from "pdf-lib"
import path from "path";
import fs from "fs";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cron from "node-cron";
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

app.get("/api/events/:id/download-pdf", auth, async (req, res) => {
  try {
    const submissions = await Submission.find({ eventId: req.params.id });
    const event = await Event.findById(req.params.id);

    if (!event) return res.status(404).send("Event not found");
    if (!submissions?.length) return res.status(404).send("No submissions found");

    // Labels and number detection
    const allFields = event.fields.map(f => f.label);
    const numberFields = event.fields
      .filter(f => f.type.toLowerCase() === "number" || /^\d+$/.test(submissions[0]?.data[f.label]?.toString()))
      .map(f => f.label);

    const totals = {};
    numberFields.forEach(label => (totals[label] = 0));

    // ✅ Load Gujarati font
    const fontPath = path.join(__dirname, "fonts", "NotoSansGujarati-Regular.ttf");
    const fontBytes = fs.readFileSync(fontPath);

    // Create PDF & embed font
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(fontBytes);
    const page = pdfDoc.addPage([600, 800]);

    const { width, height } = page.getSize();
    const fontSize = 10;
    const margin = 40;

    // Title
    page.drawText(`Submissions for ${event.name}`, {
      x: margin,
      y: height - margin - 10,
      size: 16,
      font,
      color: rgb(0, 0, 0),
    });

    let y = height - margin - 40;
    const colWidth = (width - margin * 2) / (allFields.length + 1);

    // Table Headers
    allFields.forEach((label, i) => {
      page.drawText(label, {
        x: margin + i * colWidth,
        y,
        size: fontSize,
        font,
      });
    });

    page.drawText("Submitted At", {
      x: margin + allFields.length * colWidth,
      y,
      size: fontSize,
      font,
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
        const value = String(row[label] || "");
        page.drawText(value, {
          x: margin + i * colWidth,
          y,
          size: fontSize,
          font,
        });
      });

      page.drawText(row.createdAt, {
        x: margin + allFields.length * colWidth,
        y,
        size: fontSize,
        font,
      });

      y -= 20;

      // Add a new page if space runs out
      if (y < margin + 40) {
        y = height - margin - 40;
        page = pdfDoc.addPage([600, 800]);
      }
    }

    // Totals row
    if (numberFields.length > 0) {
      y -= 10;
      allFields.forEach((label, i) => {
        const value = numberFields.includes(label) ? totals[label] : "";
        page.drawText(String(value), {
          x: margin + i * colWidth,
          y,
          size: fontSize,
          font,
        });
      });

      page.drawText("TOTAL", {
        x: margin + allFields.length * colWidth,
        y,
        size: fontSize,
        font,
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
