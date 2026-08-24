const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/user");
const NotificationService = require("../services/notificationService");

const LIMIT = 60;
const WINDOW = 60000;
const buckets = new Map();

function allowed(userId) {
  const now = Date.now();
  const row = buckets.get(String(userId)) || [];
  while (row.length && row[0] <= now - WINDOW) row.shift();
  if (row.length >= LIMIT) return false;
  row.push(now); buckets.set(String(userId), row); return true;
}

function setupGroupChatSocket(io) {
  io.on("connection", socket => {
    const userId = socket.userId?.toString();
    if (!userId) return;

    socket.on("group:join", async conversationId => {
      try {
        if (!mongoose.Types.ObjectId.isValid(conversationId)) return;
        const c = await Conversation.findOne({ _id: conversationId, participants: userId, isGroup: true }).select("_id");
        if (!c) return socket.emit("group:error", { message: "Group not found." });
        socket.join(`conversation:${c._id}`);
      } catch (e) { socket.emit("group:error", { message: "Unable to join group." }); }
    });

    socket.on("group:leave", conversationId => {
      if (conversationId) socket.leave(`conversation:${conversationId}`);
    });

    socket.on("group:typing:start", async conversationId => {
      try {
        if (!mongoose.Types.ObjectId.isValid(conversationId)) return;
        if (await Conversation.exists({ _id: conversationId, participants: userId, isGroup: true })) socket.to(`conversation:${conversationId}`).emit("group:typing:start", { userId });
      } catch (_) {}
    });
    socket.on("group:typing:stop", async conversationId => {
      try {
        if (!mongoose.Types.ObjectId.isValid(conversationId)) return;
        if (await Conversation.exists({ _id: conversationId, participants: userId, isGroup: true })) socket.to(`conversation:${conversationId}`).emit("group:typing:stop", { userId });
      } catch (_) {}
    });

    socket.on("group:read", async conversationId => {
      try {
        if (!mongoose.Types.ObjectId.isValid(conversationId)) return;
        const c = await Conversation.findOne({ _id: conversationId, participants: userId, isGroup: true }).select("_id");
        if (!c) return;
        await Message.updateMany({ conversationId: c._id, senderId: { $ne: userId }, deletedFor: { $ne: userId }, deleted: { $ne: true } }, { $addToSet: { readBy: userId } });
      } catch (_) {}
    });

    socket.on("group:send", async ({ conversationId, text = "", mediaUrl = "", mediaType = "", replyTo = null } = {}) => {
      if (!allowed(userId)) return socket.emit("group:error", { message: "You are sending messages too quickly. Please slow down." });
      try {
        if (!mongoose.Types.ObjectId.isValid(conversationId)) return socket.emit("group:error", { message: "Invalid group." });
        const cleanText = typeof text === "string" ? text.trim() : "";
        const c = await Conversation.findOne({ _id: conversationId, participants: userId, isGroup: true }).select("_id participants groupName mutedBy");
        if (!c) return socket.emit("group:error", { message: "Group not found." });
        if (!cleanText && !mediaUrl) return;
        if (cleanText.length > 5000) return socket.emit("group:error", { message: "Message is too long." });
        if (replyTo && !mongoose.Types.ObjectId.isValid(replyTo)) return socket.emit("group:error", { message: "Invalid reply." });
        if (replyTo && !await Message.exists({ _id: replyTo, conversationId: c._id })) return socket.emit("group:error", { message: "The message you are replying to was not found." });
        const sender = await User.findById(userId).select("_id fullName profileImageURL").lean();
        if (!sender) return socket.emit("group:error", { message: "User not found." });
        const receiverId = c.participants.find(x => String(x) !== userId) || null;
        const m = await Message.create({ conversationId: c._id, senderId: userId, receiverId, text: cleanText, mediaUrl: String(mediaUrl || "").trim(), mediaType: ["image","video","audio"].includes(mediaType) ? mediaType : "", replyTo: replyTo || null, readBy: [userId] });
        await Conversation.updateOne({ _id: c._id }, { $set: { lastMessage: m._id, lastMessageAt: m.createdAt }, $pull: { hiddenFor: { $in: c.participants } } });
        const payload = { _id:m._id, conversationId:c._id, senderId:{_id:sender._id,fullName:sender.fullName,profileImageURL:sender.profileImageURL}, receiverId:m.receiverId, text:m.text, mediaUrl:m.mediaUrl, mediaType:m.mediaType, replyTo:m.replyTo, createdAt:m.createdAt, updatedAt:m.updatedAt, status:"delivered", isRead:false, readBy:[userId] };
        io.to(`conversation:${c._id}`).emit("message:new", payload);
        socket.emit("message:sent", payload);
        for (const memberId of c.participants) {
          if (String(memberId) === userId) continue;
          const muted = c.mutedBy.some(x => String(x) === String(memberId));
          if (!muted) {
            try {
              await NotificationService.createNotification(memberId, "message", { title: `New message in ${c.groupName || "group"}`, message: cleanText ? cleanText.substring(0,120) : `Sent a ${mediaType || "message"}`, actor: userId, messageRef: m._id, conversationId: c._id });
            } catch (e) { console.error("group notification:", e.message); }
          }
          io.to(`user:${memberId}`).emit("notification:message", { conversationId:c._id, senderId:userId, messageId:m._id, group:true, pushSuppressed:muted });
        }
      } catch (e) { console.error("group send:", e); socket.emit("group:error", { message: "Unable to send group message." }); }
    });
  });
}

module.exports = { setupGroupChatSocket };
