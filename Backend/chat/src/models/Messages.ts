import mongoose, {Document, Schema, Types} from "mongoose";

export interface IMessage extends Document{
  chatId: Types.ObjectId;
  sender: string;
  text?: string;
  image?: {
    url: string;
    publicId: string;
  } | null;
  file?: {
    url: string;
    publicId?: string;
    originalName?: string;
    fileType?: string;
    size?: number;
  } | null;
  messageType: "text" | "image" | "pdf" | "docx" | "audio" | "file";
  delivered: boolean;
  deliveredAt?: Date;
  seen: boolean;
  seenAt?: Date;
  deletedFor: string[];
  isDeletedForEveryone: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IMessage>({
  chatId: {
    type: Schema.Types.ObjectId,
    ref: "Chat",
    required: true,
  },
  sender: {
    type: String,
    required: true,
  },
  text: String,
  image: {
    url: String,
    publicId: String,
  },
  file: {
    url: String,
    publicId: String,
    originalName: String,
    fileType: String,
    size: Number,
  },
  messageType:{
    type: String,
    enum: ["text", "image", "pdf", "docx", "audio", "file"],
    default: "text",
  },
  delivered: {
    type: Boolean,
    default: false,
  },
  deliveredAt: {
    type: Date,
    default: null,
  },
  seen: {
    type: Boolean,
    default: false,
  },
  seenAt: {
    type: Date,
    default: null,
  },
  deletedFor: {
    type: [String],
    default: [],
  },
  isDeletedForEveryone: {
    type: Boolean,
    default: false,
  },
  },
  {
  timestamps: true,
  }
);

export const Messages = mongoose.model<IMessage>("Messages", schema);