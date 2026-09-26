import mongoose, { Document, Schema } from 'mongoose';

export interface IViewer {
  user: mongoose.Types.ObjectId | string;
  viewedAt: Date;
}

export interface IStatus extends Document {
  user: mongoose.Types.ObjectId | string;
  type: 'text' | 'image';
  content?: string;
  media?: {
    url: string;
    publicId?: string;
  } | null;
  bgColor?: string;
  privacy: 'everyone' | 'selected';
  allowedUsers?: string[];
  viewers: IViewer[];
  createdAt: Date;
  expiresAt: Date;
}

const statusSchema: Schema<IStatus> = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['text', 'image'],
      default: 'text',
      required: true,
    },
    content: {
      type: String,
      default: '',
    },
    media: {
      url: { type: String },
      publicId: { type: String },
    },
    bgColor: {
      type: String,
      default: '#6366f1',
    },
    privacy: {
      type: String,
      enum: ['everyone', 'selected'],
      default: 'everyone',
    },
    allowedUsers: [
      {
        type: String,
      },
    ],
    viewers: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: false,
  }
);

export const Status = mongoose.model<IStatus>('Status', statusSchema);
