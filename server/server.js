import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cron from "node-cron";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ExcelJS from 'exceljs';
import { createCanvas, registerFont } from "canvas";

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

    const validIds = submissionIds.filter(id => mongoose.Types.ObjectId.isValid(id));

    if (validIds.length === 0) {
      return res.status(400).send("No valid submission IDs provided");
    }

    const result = await Submission.deleteMany({ _id: { $in: validIds } });

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



app.post("/api/events/:id/submit", async (req, res) => {
  const event = await Event.findById(req.params.id);
  if (!event) return res.status(404).send("Event not found");

  if (new Date() > new Date(event.expiresAt)) {
    return res.status(410).send("Link expired");
  }

  const userIp =
    req.headers["x-forwarded-for"]?.split(",")[0] || req.connection.remoteAddress;

  // Count how many times this IP has submitted for this event
  const submissionCount = await Submission.countDocuments({
    eventId: event._id,
    ip: userIp,
  });

  if (submissionCount >= 2) {
    return res.status(429).json({
      message: "You have already submitted this form twice from your IP address.",
    });
  }

  const submission = new Submission({
    eventId: event._id,
    data: req.body,
    ip: userIp,
     createdAt: new Date(), // ✅ Add this explicitly
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

    const allFields = event.fields.map((f) => f.label);
    const numberFields = event.fields
      .filter((f) => f.type?.toLowerCase() === "number")
      .map((f) => f.label);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Submissions");

    // Add header
    const headers = [...allFields, "Submitted At"];
    sheet.addRow(headers);
    sheet.getRow(1).eachCell((cell) => {
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.font = { bold: true };
    });

    const totals = {};
    numberFields.forEach((label) => (totals[label] = 0));

    // Add rows
    submissions.forEach((sub) => {
      const data = sub.data || {};
      const row = allFields.map((label) => {
        const val = data[label] ?? "";
        if (numberFields.includes(label)) {
          const num = Number(val);
          if (!isNaN(num)) totals[label] += num;
        }
        return val;
      });

      row.push(
        new Date(sub.createdAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        })
      );

      const addedRow = sheet.addRow(row);
      addedRow.eachCell((cell) => {
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });
    });

    // Add totals row
    if (numberFields.length > 0) {
      const totalRow = allFields.map((label) =>
        numberFields.includes(label) ? totals[label] : ""
      );
      totalRow.push("TOTAL");

      const addedTotalRow = sheet.addRow(totalRow);
      addedTotalRow.eachCell((cell) => {
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.font = { bold: true };
      });
    }

    // Resize columns
    sheet.columns.forEach((col) => {
      col.width = 20;
    });

    // Save and send file
    const tempPath = path.join(__dirname, "submissions.xlsx");
    await workbook.xlsx.writeFile(tempPath);

    res.download(tempPath, `submissions_${event._id}.xlsx`, (err) => {
      fs.unlink(tempPath, () => {}); // Clean up
      if (err) console.error("Download error:", err);
    });
  } catch (err) {
    console.error("XLSX Download Error:", err);
    res.status(500).send("Error generating Excel");
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

// app.get("/api/events/:id/download-pdf", auth, async (req, res) => {
//   try {
//     const submissions = await Submission.find({ eventId: req.params.id });
//     const event = await Event.findById(req.params.id);

//     if (!event) return res.status(404).send("Event not found");
//     if (!submissions?.length) return res.status(404).send("No submissions found");

//     const allFields = event.fields.map(f => f.label);
//     const numberFields = event.fields
//       .filter(f => f.type.toLowerCase() === "number" || /^\d+$/.test(submissions[0]?.data[f.label]?.toString()))
//       .map(f => f.label);

//     const totals = {};
//     numberFields.forEach(label => (totals[label] = 0));

//     const fontPath = path.join(__dirname, "fonts", "NotoSansGujarati-Regular.ttf");
//     const fontBytes = fs.readFileSync(fontPath);

//     const pdfDoc = await PDFDocument.create();
//     pdfDoc.registerFontkit(fontkit);
//     const font = await pdfDoc.embedFont(fontBytes);

//     let page = pdfDoc.addPage([900, 1200]);
//     const { width, height } = page.getSize();
//     const margin = 40;
//     const fontSize = 10;
//     const lineHeight = fontSize + 4;

//     const wrapText = (text, maxWidth) => {
//       const words = String(text || "").split(" ");
//       const lines = [];
//       let line = "";
//       for (const word of words) {
//         const testLine = line + word + " ";
//         if (font.widthOfTextAtSize(testLine, fontSize) > maxWidth) {
//           lines.push(line.trim());
//           line = word + " ";
//         } else {
//           line = testLine;
//         }
//       }
//       if (line) lines.push(line.trim());
//       return lines;
//     };

//     let y = height - margin;
//     page.drawText(`Submissions for ${event.name}`, {
//       x: margin,
//       y: y - 10,
//       size: 16,
//       font,
//       color: rgb(0, 0, 0),
//     });

//     y -= 40;

//     const columns = [...allFields, "Submitted At"];
//     const colWidth = (width - margin * 2) / columns.length;

//     const drawRow = (rowValues, yStart) => {
//       const maxLines = Math.max(...rowValues.map(val => wrapText(val, colWidth - 6).length));
//       const rowHeight = maxLines * lineHeight + 4;

//       columns.forEach((key, i) => {
//         const x = margin + i * colWidth;
//         const textLines = wrapText(rowValues[i], colWidth - 6);

//         // Cell rectangle
//         page.drawRectangle({
//           x,
//           y: yStart - rowHeight,
//           width: colWidth,
//           height: rowHeight,
//           borderWidth: 0.5,
//           borderColor: rgb(0, 0, 0),
//         });

//         // Draw wrapped text
//         textLines.forEach((line, lineIndex) => {
//           page.drawText(line, {
//             x: x + 3,
//             y: yStart - (lineIndex + 1) * lineHeight - 2,
//             size: fontSize,
//             font,
//             color: rgb(0, 0, 0),
//           });
//         });
//       });

//       return rowHeight;
//     };

//     // Draw table header
//     const headerHeight = drawRow(columns, y);
//     y -= headerHeight;

//     // Draw rows
//     for (const sub of submissions) {
//       const row = [];
//       allFields.forEach(label => {
//         const val = sub.data[label] ?? "";
//         row.push(val);
//         if (numberFields.includes(label)) {
//           const num = Number(val);
//           if (!isNaN(num)) totals[label] += num;
//         }
//       });
//       row.push(new Date(sub.createdAt).toLocaleString());

//       const rowHeight = drawRow(row, y);
//       y -= rowHeight;

//       if (y < margin + 100) {
//         page = pdfDoc.addPage([900, 1200]);
//         y = height - margin;
//       }
//     }

//     // Draw total row
//     if (numberFields.length > 0) {
//       const totalRow = allFields.map(label => numberFields.includes(label) ? totals[label].toString() : "");
//       totalRow.push("TOTAL");
//       drawRow(totalRow, y);
//     }

//     const pdfBytes = await pdfDoc.save();
//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader("Content-Disposition", `attachment; filename="submissions_${event._id}.pdf"`);
//     res.send(Buffer.from(pdfBytes));

//   } catch (err) {
//     console.error("Error generating PDF:", err);
//     res.status(500).send("Error generating PDF");
//   }
// });

  app.get("/api/events/:id/download-pdf", auth, async (req, res) => {
    try {
      const submissions = await Submission.find({ eventId: req.params.id });
      const event = await Event.findById(req.params.id);

      if (!event) return res.status(404).send("Event not found");
      if (!submissions?.length) return res.status(404).send("No submissions found");

      const allFields = event.fields.map(f => f.label);
      // Only include fields explicitly marked as type "number"
      const numberFields = event.fields
        .filter(f => f.type.toLowerCase() === "number")
        .map(f => f.label);

      const totals = {};
      numberFields.forEach(label => (totals[label] = 0));

      // Load Gujarati font
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

      const primaryColor = rgb(59 / 255, 130 / 255, 246 / 255); // blue-500
      const headerBgColor = rgb(229 / 255, 231 / 255, 235 / 255); // gray-200
      const rowBgColor = rgb(249 / 255, 250 / 255, 251 / 255); // gray-50
      const borderColor = rgb(229 / 255, 231 / 255, 235 / 255); // gray-200
      const textColor = rgb(31 / 255, 41 / 255, 55 / 255); // gray-800

      // Header section
      page.drawRectangle({
        x: 0,
        y: height - 100,
        width,
        height: 100,
        color: primaryColor,
      });

      page.drawText(`Submissions for ${event.name}`, {
        x: margin,
        y: height - margin - 20,
        size: 20,
        font,
        color: rgb(1, 1, 1),
      });

      if (event.description) {
        page.drawText(event.description, {
          x: margin,
          y: height - margin - 45,
          size: 12,
          font,
          color: rgb(1, 1, 1),
        });
      }

      let y = height - 120;
      const columns = [...allFields, "Submitted At"];
      const colWidth = (width - margin * 2) / columns.length;

      const drawRow = (rowValues, bgColor = null) => {
        const rowHeight = 20;

        if (bgColor) {
          page.drawRectangle({
            x: margin,
            y: y - rowHeight,
            width: width - margin * 2,
            height: rowHeight,
            color: bgColor,
            borderColor,
            borderWidth: 0.5,
          });
        }

        rowValues.forEach((value, i) => {
          const text = String(value ?? "");
          page.drawText(text, {
            x: margin + i * colWidth + 5,
            y: y - 15,
            size: fontSize,
            font,
            color: textColor,
          });
        });

        y -= rowHeight;

        if (y < margin + 50) {
          page = pdfDoc.addPage([900, 1200]);
          y = height - margin;
        }
      };

      // Draw header
      const headerRow = columns.map(col =>
        numberFields.includes(col) ? `${col} (#)` : col
      );
      drawRow(headerRow, headerBgColor);

      // Submissions
      submissions.forEach((sub, index) => {
        const row = allFields.map(label => {
          const val = sub.data[label] ?? "";
          // Only process totals for explicitly marked number fields
          if (numberFields.includes(label)) {
            const num = Number(val);
            if (!isNaN(num)) totals[label] += num;
          }
          return val;
        });

        // Local IST time format
        row.push(
          new Date(sub.createdAt).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
          })
        );

        const bg = index % 2 === 0 ? rowBgColor : null;
        drawRow(row, bg);
      });

      // Totals row (only if we have number fields)
      if (numberFields.length > 0) {
        const totalRow = allFields.map(label =>
          numberFields.includes(label) ? totals[label].toString() : ""
        );
        totalRow.push("TOTAL");
        drawRow(totalRow, headerBgColor);
      }

      // Footer with IST time
      page.drawText(
        `Generated on ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} | Total submissions: ${submissions.length}`,
        {
          x: margin,
          y: margin - 10,
          size: 8,
          font,
          color: rgb(0.5, 0.5, 0.5),
        }
      );

      const pdfBytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="submissions_${event._id}.pdf"`);
      res.send(Buffer.from(pdfBytes));
    } catch (err) {
      console.error("Error generating PDF:", err);
      res.status(500).send("Error generating PDF");
    }
  });

app.get("/api/events/:id/download-image", auth, async (req, res) => {
  try {
    const submissions = await Submission.find({ eventId: req.params.id });
    const event = await Event.findById(req.params.id);

    if (!event) return res.status(404).send("Event not found");
    if (!submissions?.length) return res.status(404).send("No submissions found");

    // Register Gujarati font
    const fontPath = path.join(__dirname, "fonts", "NotoSansGujarati-Regular.ttf");
    registerFont(fontPath, { family: "Gujarati" });

    const allFields = event.fields.map(f => f.label);
    const numberFields = event.fields
      .filter(f => f.type === "number" || f.type === "Number")
      .map(f => f.label);

    const totals = {};
    numberFields.forEach(label => (totals[label] = 0));

    // Prepare rows
    const rows = submissions.map(sub => {
      const row = {};
      allFields.forEach(label => {
        const val = sub.data[label] ?? "";
        row[label] = val;
        if (numberFields.includes(label)) {
          const num = Number(val);
          if (!isNaN(num)) totals[label] += num;
        }
      });
      row["Submitted At"] = new Date(sub.createdAt).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
      });
      return row;
    });

    const headers = [...allFields, "Submitted At"];

    // Canvas setup
    const rowHeight = 36;
    const colWidth = 200;
    const canvasWidth = headers.length * colWidth + 60;
    const canvasHeight = (rows.length + 3) * rowHeight + 100;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = "#F9FAFB";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.font = "bold 24px Gujarati";
    ctx.fillStyle = "#1E293B";
    ctx.fillText(`📋 ${event.name}`, 30, 40);

    // Description
    if (event.description) {
      ctx.font = "18px Gujarati";
      ctx.fillStyle = "#475569";
      ctx.fillText(event.description, 30, 70);
    }

    let y = 100;

    // Headers
    ctx.font = "bold 16px Gujarati";
    headers.forEach((label, i) => {
      ctx.fillStyle = "#1F2937";
      const text = numberFields.includes(label) ? `${label} (#)` : label;
      ctx.fillText(text, 30 + i * colWidth, y);
    });

    y += rowHeight;

    // Rows
    ctx.font = "15px Gujarati";
    rows.forEach((row, rowIndex) => {
      ctx.fillStyle = rowIndex % 2 === 0 ? "#FFFFFF" : "#F1F5F9";
      ctx.fillRect(20, y - rowHeight + 8, canvas.width - 40, rowHeight);

      headers.forEach((label, i) => {
        ctx.fillStyle = "#1F2937";
        const text = String(row[label] ?? "");
        ctx.fillText(text, 30 + i * colWidth, y);
      });

      y += rowHeight;
    });

    // Totals row
    if (numberFields.length > 0) {
      ctx.fillStyle = "#E2E8F0";
      ctx.fillRect(20, y - rowHeight + 8, canvas.width - 40, rowHeight);

      headers.forEach((label, i) => {
        ctx.font = "bold 15px Gujarati";
        ctx.fillStyle = "#0F172A";
        const text = numberFields.includes(label)
          ? totals[label].toString()
          : label === "Submitted At"
          ? "TOTAL"
          : "";
        ctx.fillText(text, 30 + i * colWidth, y);
      });
    }

    const buffer = canvas.toBuffer("image/png");
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Disposition", `attachment; filename="submissions_${event._id}.png"`);
    res.send(buffer);
  } catch (err) {
    console.error("Image Export Error:", err);
    res.status(500).send("Error generating image");
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
