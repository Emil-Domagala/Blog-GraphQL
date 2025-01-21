import mongoose, { Schema } from 'mongoose';

const userSchema = new Schema({
  email: { type: String, required: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  status: { type: String, default: 'New user' },
  posts: [{ type: Schema.Types.ObjectId, ref: 'Post', required: false }],
});

const UserModel = mongoose.model('User', userSchema);
export { UserModel };
