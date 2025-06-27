// server.js
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cron from "node-cron";
import { Event, Submission } from "./models.js";
import { createObjectCsvWriter } from "csv-writer";
import fs from "fs";

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

app.get("/api/events/:id/download", auth, async (req, res) => {
  const submissions = await Submission.find({ eventId: req.params.id });
  const event = await Event.findById(req.params.id);

  // Make header: ID, each field label, CreatedAt
  const headers = [
    { id: "_id", title: "ID" },
    ...event.fields.map(f => ({ id: f.label, title: f.label })),
    { id: "createdAt", title: "Submitted At" },
  ];

  // Build records
  const records = submissions.map(s => {
    const row = { _id: s._id, createdAt: s.createdAt };
    event.fields.forEach(f => {
      row[f.label] = s.data[f.label] || "";
    });
    return row;
  });

  const csvWriter = createObjectCsvWriter({
    path: "submissions.csv",
    header: headers,
  });

  await csvWriter.writeRecords(records);

  res.download("submissions.csv");
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
