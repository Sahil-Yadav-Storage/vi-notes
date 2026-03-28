import mongoose from "mongoose";

const DocumentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    content: { type: String, default: "" },
    lastOpenedSessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: false,
    },
  },
  {
    timestamps: true,
  },
);

DocumentSchema.index({ user: 1, name: 1 }, { unique: true });

export default mongoose.model("Document", DocumentSchema);
