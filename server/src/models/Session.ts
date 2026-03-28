import mongoose from "mongoose";

const KeystrokeSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ["down", "up", "paste", "edit"],
    required: true,
  },
  rawTimestamp: Number,
  timestamp: { type: Number, required: true },
  rawDuration: Number,
  duration: Number,
  pasteLength: Number,
  pasteSelectionStart: Number,
  pasteSelectionEnd: Number,
  editedLater: Boolean,
  editStart: Number,
  editEnd: Number,
  insertedLength: Number,
  removedLength: Number,
});

const SessionAnalyticsSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    approximateWpmVariance: { type: Number, required: true },
    pauseFrequency: { type: Number, required: true },
    editRatio: { type: Number, required: true },
    pasteRatio: { type: Number, required: true },
    totalInsertedChars: { type: Number, required: true },
    totalDeletedChars: { type: Number, required: true },
    finalChars: { type: Number, required: true },
    totalPastedChars: { type: Number, required: true },
    pauseCount: { type: Number, required: true },
    durationMs: { type: Number, required: true },
  },
  { _id: false },
);

const SessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Document",
    required: false,
  },
  code: {
    type: String,
    required: false,
    unique: true,
    sparse: true, // Allow multiple null values
  },
  keystrokes: [KeystrokeSchema],
  status: {
    type: String,
    enum: ["active", "closed"],
    default: "active",
    required: true,
  },
  closedAt: Date,
  analytics: SessionAnalyticsSchema,
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Session", SessionSchema);
