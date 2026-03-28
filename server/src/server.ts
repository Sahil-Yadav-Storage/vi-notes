import app from "./app.js";
import mongoose from "mongoose";
import { config } from "./config.js";

mongoose
  .connect(config.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
    app.listen(config.PORT, () => {
      console.log(`Server running on port ${config.PORT}`);
    });
  })
  .catch(console.error);
