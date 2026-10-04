import mongoose, {Document, Schema} from "mongoose";

export interface IUser extends Document{
  name: string;
  email: string;
  avatar?: {
    url: string;
    publicId: string;
  };
  contacts?: mongoose.Types.ObjectId[];
}

const schema: Schema<IUser> = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  avatar: {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
  },
  contacts: [{
    type: Schema.Types.ObjectId,
    ref: "User",
    default: [],
  }],
},
{
    timestamps: true,
}
);

export const User = mongoose.model<IUser>("User", schema);