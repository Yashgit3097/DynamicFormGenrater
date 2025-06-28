// models.js
import mongoose from "mongoose";

const fieldSchema = new mongoose.Schema({
  label: String,
  type: String,
});

const eventSchema = new mongoose.Schema({
  name: String,
  description: String,
  fields: [fieldSchema],
  expiresAt: Date,
});

const submissionSchema = new mongoose.Schema({
  eventId: mongoose.Schema.Types.ObjectId,
  data: Object,
   ip: { type: String, required: true }, // Add this line
  createdAt: { type: Date, default: Date.now },
});

export const Event = mongoose.model("Event", eventSchema);
export const Submission = mongoose.model("Submission", submissionSchema);
