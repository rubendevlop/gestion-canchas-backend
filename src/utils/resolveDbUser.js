import User from '../models/User.js';

export const resolveDbUser = async (authUser) => {
  const { uid, email, name, picture } = authUser || {};

  if (!uid) return null;

  let user = await User.findOne({ uid });
  if (user) return user;

  if (!email) return null;

  user = await User.findOne({ email });
  if (!user) return null;

  user.uid = uid;

  if (name && user.displayName !== name) {
    user.displayName = name;
  }

  if (picture && user.photoURL !== picture) {
    user.photoURL = picture;
  }

  await user.save();
  return user;
};
