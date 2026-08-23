const { buildSchema } = require("graphql");
const mongoose = require("mongoose");
const Blog = require("../models/Blog");
const User = require("../models/user");
const Comment = require("../models/Comment");
const Notification = require("../models/Notification");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

const schema = buildSchema(`
  type User {
    _id: ID!
    fullName: String
    profileImageURL: String
    bio: String
    website: String
    location: String
    role: String
    isPrivate: Boolean
    followerCount: Int
    followingCount: Int
    followers: [User]
    following: [User]
    posts: [Blog]
    isFollowing: Boolean
  }

  type Blog {
    _id: ID!
    title: String
    body: String
    excerpt: String
    slug: String
    coverImageURL: String
    mediaType: String
    videoURL: String
    tags: [String]
    category: String
    status: String
    createdAt: String
    updatedAt: String
    viewCount: Int
    likeCount: Int
    likedByMe: Boolean
    createdBy: User
    likes: [User]
    comments: [Comment]
  }

  type Comment {
    _id: ID!
    content: String
    createdAt: String
    updatedAt: String
    author: User
    blog: ID
    parentComment: ID
    likeCount: Int
    likedByMe: Boolean
    likes: [User]
    replies: [Comment]
  }

  type Notification {
    _id: ID!
    type: String
    title: String
    message: String
    isRead: Boolean
    createdAt: String
    blog: ID
    actor: User
    request: ID
    messageRef: ID
    conversationId: ID
  }

  type Message {
    _id: ID!
    conversationId: ID!
    senderId: ID!
    receiverId: ID!
    sender: User
    receiver: User
    text: String
    mediaUrl: String
    mediaType: String
    profileShareId: ID
    replyTo: Message
    status: String
    isRead: Boolean
    edited: Boolean
    deleted: Boolean
    deletedForMe: Boolean
    saved: Boolean
    likeCount: Int
    likedByMe: Boolean
    createdAt: String
    updatedAt: String
  }

  type Conversation {
    _id: ID!
    participants: [User]
    updatedAt: String
    lastMessage: Message
  }

  type Query {
    blogs(search: String, sort: String, page: Int = 1, limit: Int = 9): [Blog]
    blog(id: ID!): Blog
    me: User
    user(id: ID!): User
    users(search: String, page: Int = 1, limit: Int = 20): [User]
    comments(blogId: ID!, page: Int = 1, limit: Int = 30): [Comment]
    notifications(unreadOnly: Boolean = false, page: Int = 1, limit: Int = 30): [Notification]
    messages(conversationId: ID!, page: Int = 1, limit: Int = 50): [Message]
    conversations(page: Int = 1, limit: Int = 30): [Conversation]
  }

  type Mutation {
    createComment(blogId: ID!, content: String!, parentCommentId: ID): Comment
    deleteComment(id: ID!): Boolean
    toggleBlogLike(blogId: ID!): Blog
    toggleCommentLike(commentId: ID!): Comment
    followUser(userId: ID!): User
    unfollowUser(userId: ID!): User
    markNotificationRead(id: ID!): Boolean
    markAllNotificationsRead: Boolean
    markMessageRead(id: ID!): Message
    toggleMessageLike(id: ID!): Message
  }
`);

function objectId(id) {
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
}

function viewerId(context) {
  return context?.user?._id || null;
}

function requireViewer(context) {
  const id = viewerId(context);
  if (!id) throw new Error("Authentication required");
  return id;
}

function safePagination(page, limit, defaultLimit = 30, maxLimit = 50) {
  const safePage = Math.min(Math.max(Number.isInteger(page) ? page : 1, 1), 100000);
  const safeLimit = Math.min(Math.max(Number.isInteger(limit) ? limit : defaultLimit, 1), maxLimit);
  return { page: safePage, limit: safeLimit };
}

function hasId(list, id) {
  return Array.isArray(list) && list.some(value => String(value?._id || value) === String(id));
}

async function canAccessUser(target, viewer) {
  if (!target || target.isDeactivated) return false;
  if (!target.isPrivate || !viewer) return true;
  return String(target._id) === String(viewer) || hasId(target.followers, viewer);
}

async function canAccessBlog(blog, viewer) {
  if (!blog || blog.isDeleted || blog.status !== "published") return false;
  const author = await User.findById(blog.createdBy).select("isPrivate followers isDeactivated").lean();
  if (!author || author.isDeactivated) return false;
  if (!author.isPrivate) return true;
  return viewer && (String(author._id) === String(viewer) || hasId(author.followers, viewer));
}

async function populateUser(user, viewer) {
  if (!user) return null;
  const doc = user.toObject ? user.toObject() : { ...user };
  doc.followerCount = Array.isArray(doc.followers) ? doc.followers.length : 0;
  doc.followingCount = Array.isArray(doc.following) ? doc.following.length : 0;
  doc.isFollowing = viewer ? hasId(doc.followers, viewer) : false;
  if (Array.isArray(doc.followers)) {
    doc.followers = await User.find({ _id: { $in: doc.followers }, isDeactivated: false }).select("fullName profileImageURL bio website location role isPrivate followers following").lean();
  }
  if (Array.isArray(doc.following)) {
    doc.following = await User.find({ _id: { $in: doc.following }, isDeactivated: false }).select("fullName profileImageURL bio website location role isPrivate followers following").lean();
  }
  const posts = await Blog.find({ createdBy: doc._id, isDeleted: false, status: "published" }).sort({ createdAt: -1 }).limit(20).populate("createdBy", "fullName profileImageURL bio website location role isPrivate followers following").lean();
  doc.posts = await Promise.all(posts.filter(post => post.createdBy).map(post => decorateBlog(post, viewer)));
  return doc;
}

async function decorateBlog(blog, viewer) {
  if (!blog) return null;
  const doc = { ...blog };
  doc.likeCount = Array.isArray(doc.likes) ? doc.likes.length : 0;
  doc.likedByMe = viewer ? hasId(doc.likes, viewer) : false;
  if (Array.isArray(doc.likes)) {
    doc.likes = await User.find({ _id: { $in: doc.likes }, isDeactivated: false }).select("fullName profileImageURL bio website location role isPrivate followers following").lean();
  }
  if (doc.createdBy) doc.createdBy = await populateUser(doc.createdBy, viewer);
  return doc;
}

async function decorateComment(comment, viewer, includeReplies = true) {
  if (!comment) return null;
  const doc = { ...comment };
  doc.likeCount = Array.isArray(doc.likes) ? doc.likes.length : 0;
  doc.likedByMe = viewer ? hasId(doc.likes, viewer) : false;
  if (doc.author && doc.author._id) doc.author = await populateUser(doc.author, viewer);
  if (Array.isArray(doc.likes)) doc.likes = await User.find({ _id: { $in: doc.likes }, isDeactivated: false }).select("fullName profileImageURL bio website location role isPrivate followers following").lean();
  if (includeReplies) {
    const replies = await Comment.find({ parentComment: doc._id, isDeleted: false, isApproved: true }).sort({ createdAt: 1 }).populate("author", "fullName profileImageURL bio website location role isPrivate followers following").lean();
    doc.replies = await Promise.all(replies.map(reply => decorateComment(reply, viewer, false)));
  }
  return doc;
}

async function decorateMessage(message, viewer) {
  if (!message) return null;
  const doc = { ...message };
  doc.deletedForMe = hasId(doc.deletedFor, viewer);
  doc.saved = hasId(doc.savedBy, viewer);
  doc.likeCount = Array.isArray(doc.likes) ? doc.likes.length : 0;
  doc.likedByMe = hasId(doc.likes, viewer);
  if (doc.senderId) doc.sender = await User.findById(doc.senderId).select("fullName profileImageURL role isPrivate").lean();
  if (doc.receiverId) doc.receiver = await User.findById(doc.receiverId).select("fullName profileImageURL role isPrivate").lean();
  if (doc.replyTo) {
    const reply = await Message.findOne({ _id: doc.replyTo, deletedFor: { $ne: viewer } }).lean();
    doc.replyTo = reply ? await decorateMessage(reply, viewer) : null;
  }
  return doc;
}

const root = {
  blogs: async ({ search, sort = "newest", page = 1, limit = 9 }, context) => {
    try {
      const viewer = viewerId(context);
      const { page: safePage, limit: safeLimit } = safePagination(page, limit, 9, 50);
      const privateUsers = await User.find({ isPrivate: true, isDeactivated: false }).select("_id followers").lean();
      const privateIds = privateUsers.map(u => u._id);
      const followedPrivate = viewer ? privateUsers.filter(u => hasId(u.followers, viewer)).map(u => u._id) : [];
      const visibility = { $or: [{ createdBy: { $nin: privateIds } }, { createdBy: { $in: followedPrivate } }, ...(viewer ? [{ createdBy: viewer }] : [])] };
      const filter = { isDeleted: false, status: "published", ...visibility };
      if (typeof search === "string" && search.trim()) {
        const escaped = search.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.$and = [visibility, { $or: [{ title: { $regex: escaped, $options: "i" } }, { body: { $regex: escaped, $options: "i" } }] }];
      }
      const sortOption = sort === "oldest" ? { createdAt: 1 } : sort === "title" ? { title: 1 } : sort === "trending" ? { viewCount: -1 } : { createdAt: -1 };
      const blogs = await Blog.find(filter).sort(sortOption).skip((safePage - 1) * safeLimit).limit(safeLimit).populate("createdBy", "fullName profileImageURL bio website location role isPrivate followers following").lean();
      return Promise.all(blogs.map(blog => decorateBlog(blog, viewer)));
    } catch (error) { console.error("GraphQL blogs error:", error); return []; }
  },

  blog: async ({ id }, context) => {
    const oid = objectId(id);
    if (!oid) return null;
    const viewer = viewerId(context);
    const blog = await Blog.findOne({ _id: oid, isDeleted: false, status: "published" }).populate("createdBy", "fullName profileImageURL bio website location role isPrivate followers following").lean();
    if (!(await canAccessBlog(blog, viewer))) return null;
    const decorated = await decorateBlog(blog, viewer);
    const comments = await Comment.find({ blog: oid, isDeleted: false, isApproved: true, parentComment: null }).sort({ createdAt: 1 }).populate("author", "fullName profileImageURL bio website location role isPrivate followers following").lean();
    decorated.comments = await Promise.all(comments.map(comment => decorateComment(comment, viewer)));
    return decorated;
  },

  me: async (args, context) => {
    const id = requireViewer(context);
    return populateUser(await User.findOne({ _id: id, isDeactivated: false }).lean(), id);
  },

  user: async ({ id }, context) => {
    const oid = objectId(id); if (!oid) return null;
    const viewer = viewerId(context);
    const user = await User.findOne({ _id: oid, isDeactivated: false }).lean();
    if (!(await canAccessUser(user, viewer))) return null;
    return populateUser(user, viewer);
  },

  users: async ({ search, page = 1, limit = 20 }, context) => {
    const viewer = viewerId(context);
    const { page: safePage, limit: safeLimit } = safePagination(page, limit, 20, 50);
    const filter = { isDeactivated: false };
    if (typeof search === "string" && search.trim()) filter.fullName = { $regex: search.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
    const users = await User.find(filter).select("fullName profileImageURL bio website location role isPrivate followers following isDeactivated").sort({ fullName: 1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean();
    return Promise.all(users.map(user => populateUser(user, viewer)));
  },

  comments: async ({ blogId, page = 1, limit = 30 }, context) => {
    const oid = objectId(blogId); if (!oid) return [];
    const viewer = viewerId(context);
    const blog = await Blog.findOne({ _id: oid, isDeleted: false, status: "published" }).lean();
    if (!(await canAccessBlog(blog, viewer))) return [];
    const { page: safePage, limit: safeLimit } = safePagination(page, limit);
    const comments = await Comment.find({ blog: oid, isDeleted: false, isApproved: true, parentComment: null }).sort({ createdAt: 1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).populate("author", "fullName profileImageURL bio website location role isPrivate followers following").lean();
    return Promise.all(comments.map(comment => decorateComment(comment, viewer)));
  },

  notifications: async ({ unreadOnly = false, page = 1, limit = 30 }, context) => {
    const viewer = requireViewer(context);
    const { page: safePage, limit: safeLimit } = safePagination(page, limit);
    const filter = { recipient: viewer }; if (unreadOnly) filter.isRead = false;
    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).populate("actor", "fullName profileImageURL role isPrivate").lean();
    return notifications;
  },

  messages: async ({ conversationId, page = 1, limit = 50 }, context) => {
    const viewer = requireViewer(context); const conversation = await Conversation.findOne({ _id: objectId(conversationId), participants: viewer }).lean();
    if (!conversation) return [];
    const { page: safePage, limit: safeLimit } = safePagination(page, limit, 50, 100);
    const messages = await Message.find({ conversationId: conversation._id, deletedFor: { $ne: viewer } }).sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean();
    return Promise.all(messages.reverse().map(message => decorateMessage(message, viewer)));
  },

  conversations: async ({ page = 1, limit = 30 }, context) => {
    const viewer = requireViewer(context); const { page: safePage, limit: safeLimit } = safePagination(page, limit);
    const conversations = await Conversation.find({ participants: viewer }).sort({ updatedAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean();
    return Promise.all(conversations.map(async conversation => {
      const doc = { ...conversation };
      doc.participants = await User.find({ _id: { $in: conversation.participants }, isDeactivated: false }).select("fullName profileImageURL role isPrivate").lean();
      const last = await Message.findOne({ conversationId: conversation._id, deletedFor: { $ne: viewer } }).sort({ createdAt: -1 }).lean();
      doc.lastMessage = last ? await decorateMessage(last, viewer) : null;
      return doc;
    }));
  },

  createComment: async ({ blogId, content, parentCommentId }, context) => {
    const viewer = requireViewer(context); const blog = await Blog.findOne({ _id: objectId(blogId), isDeleted: false, status: "published" }).lean();
    if (!(await canAccessBlog(blog, viewer))) throw new Error("Blog not found or not accessible");
    const text = String(content || "").trim(); if (!text || text.length > 5000) throw new Error("Comment must be between 1 and 5000 characters");
    let parent = null;
    if (parentCommentId) {
      parent = await Comment.findOne({ _id: objectId(parentCommentId), blog: blog._id, isDeleted: false }).lean();
      if (!parent) throw new Error("Parent comment not found");
    }
    const comment = await Comment.create({ content: text, blog: blog._id, author: viewer, parentComment: parent?._id || null });
    return decorateComment(await Comment.findById(comment._id).populate("author", "fullName profileImageURL bio website location role isPrivate followers following").lean(), viewer);
  },

  deleteComment: async ({ id }, context) => {
    const viewer = requireViewer(context); const comment = await Comment.findOne({ _id: objectId(id), author: viewer, isDeleted: false });
    if (!comment) throw new Error("Comment not found or not owned by you");
    comment.isDeleted = true; await comment.save(); return true;
  },

  toggleBlogLike: async ({ blogId }, context) => {
    const viewer = requireViewer(context); const blog = await Blog.findOne({ _id: objectId(blogId), isDeleted: false, status: "published" });
    if (!(await canAccessBlog(blog, viewer))) throw new Error("Blog not found or not accessible");
    if (hasId(blog.likes, viewer)) blog.likes = blog.likes.filter(id => String(id) !== String(viewer)); else blog.likes.push(viewer);
    await blog.save();
    return decorateBlog(await Blog.findById(blog._id).populate("createdBy", "fullName profileImageURL bio website location role isPrivate followers following").lean(), viewer);
  },

  toggleCommentLike: async ({ commentId }, context) => {
    const viewer = requireViewer(context); const comment = await Comment.findOne({ _id: objectId(commentId), isDeleted: false, isApproved: true });
    if (!comment) throw new Error("Comment not found");
    const blog = await Blog.findOne({ _id: comment.blog, isDeleted: false, status: "published" }).lean();
    if (!(await canAccessBlog(blog, viewer))) throw new Error("Comment is not accessible");
    if (hasId(comment.likes, viewer)) comment.likes = comment.likes.filter(id => String(id) !== String(viewer)); else comment.likes.push(viewer);
    await comment.save();
    return decorateComment(await Comment.findById(comment._id).populate("author", "fullName profileImageURL bio website location role isPrivate followers following").lean(), viewer);
  },

  followUser: async ({ userId }, context) => {
    const viewer = requireViewer(context); const targetId = objectId(userId);
    if (!targetId || String(targetId) === String(viewer)) throw new Error("Invalid follow target");
    const target = await User.findOne({ _id: targetId, isDeactivated: false });
    if (!target) throw new Error("User not found");
    const me = await User.findById(viewer);
    if (!hasId(me.following, target._id)) me.following.push(target._id);
    if (!hasId(target.followers, me._id)) target.followers.push(me._id);
    await Promise.all([me.save(), target.save()]);
    return populateUser(await User.findById(target._id).lean(), viewer);
  },

  unfollowUser: async ({ userId }, context) => {
    const viewer = requireViewer(context); const targetId = objectId(userId);
    if (!targetId || String(targetId) === String(viewer)) throw new Error("Invalid unfollow target");
    const me = await User.findById(viewer); const target = await User.findOne({ _id: targetId, isDeactivated: false });
    if (!me || !target) throw new Error("User not found");
    me.following = me.following.filter(id => String(id) !== String(target._id));
    target.followers = target.followers.filter(id => String(id) !== String(me._id));
    await Promise.all([me.save(), target.save()]);
    return populateUser(await User.findById(target._id).lean(), viewer);
  },

  markNotificationRead: async ({ id }, context) => {
    const viewer = requireViewer(context); const result = await Notification.updateOne({ _id: objectId(id), recipient: viewer }, { $set: { isRead: true } });
    return result.modifiedCount > 0 || result.matchedCount > 0;
  },

  markAllNotificationsRead: async (args, context) => {
    const viewer = requireViewer(context); await Notification.updateMany({ recipient: viewer, isRead: false }, { $set: { isRead: true } }); return true;
  },

  markMessageRead: async ({ id }, context) => {
    const viewer = requireViewer(context); const message = await Message.findOne({ _id: objectId(id), receiverId: viewer });
    if (!message) throw new Error("Message not found or not yours");
    message.isRead = true; message.status = "read"; await message.save(); return decorateMessage(message.toObject(), viewer);
  },

  toggleMessageLike: async ({ id }, context) => {
    const viewer = requireViewer(context); const message = await Message.findOne({ _id: objectId(id), $or: [{ senderId: viewer }, { receiverId: viewer }] });
    if (!message) throw new Error("Message not found or not accessible");
    if (hasId(message.likes, viewer)) message.likes = message.likes.filter(userId => String(userId) !== String(viewer)); else message.likes.push(viewer);
    await message.save(); return decorateMessage(message.toObject(), viewer);
  }
};

module.exports = { schema, root };
