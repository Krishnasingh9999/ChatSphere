import mongoose, { Document, Schema } from "mongoose";

export interface IChatSecurity extends Document {
  user: string;
  passcodeHash: string;
  salt: string;
  lockedChatIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const schema: Schema<IChatSecurity> = new Schema(
  {
    user: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    passcodeHash: {
      type: String,
      required: true,
    },
    salt: {
      type: String,
      required: true,
    },
    lockedChatIds: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const ChatSecurity = mongoose.model<IChatSecurity>("chat_security", schema);
