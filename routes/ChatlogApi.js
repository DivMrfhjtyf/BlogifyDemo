const express = require("express");
const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/user");

const router = express.Router();
const auth = (req, res, next) => req.user ? next() : res.status(401).json({ success: false, message: "Authentication required" });
const validId = value => mongoose.Types.ObjectId.isValid(value);

router.get("/history", auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const conversations = await Conversation.find({
      participants: userId,
      hiddenFor: { $ne: userId }
    })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate("participants", "fullName profileImageURL isPrivate")
      .populate("lastMessage", "text mediaUrl mediaType profileShareId senderId receiverId status isRead createdAt deleted deletedFor")
      .lean();

    const result = [];
    for (const conversation of conversations) {
      let last = conversation.lastMessage;
      if (!last || last.deleted || (last.deletedFor || []).some(x => String(x) === String(userId))) {
        last = await Message.findOne({
          conversationId: conversation._id,
          deletedFor: { $ne: userId },
          deleted: { $ne: true }
        }).sort({ createdAt: -1 }).select("text mediaUrl mediaType profileShareId senderId receiverId status isRead createdAt deleted deletedFor").lean();
      }
      if (!last) continue;
      const unread = await Message.countDocuments({
        conversationId: conversation._id,
        senderId: { $ne: userId },
        deletedFor: { $ne: userId },
        deleted: { $ne: true },
        $or: [
          { readBy: { $ne: userId } },
          { readBy: { $exists: false }, isRead: false }
        ]
      });
      const participants = conversation.participants || [];
      const other = participants.find(p => String(p._id) !== String(userId));
      result.push({
        ...conversation,
        participants,
        isGroup: !!conversation.isGroup,
        groupName: conversation.groupName || "",
        groupAvatar: conversation.groupAvatar || "",
        pinned: (conversation.pinnedBy || []).some(x => String(x) === String(userId)),
        muted: (conversation.mutedBy || []).some(x => String(x) === String(userId)),
        lastMessage: last,
        lastMessageAt: last.createdAt,
        unreadCount: unread,
        otherUser: conversation.isGroup ? null : other || null
      });
    }
    result.sort((a, b) => Number(b.pinned) - Number(a.pinned) || new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
    res.json({ success: true, conversations: result });
  } catch (error) {
    console.error("chatlog api history:", error);
    res.status(500).json({ success: false, message: "Unable to load chat history" });
  }
});

router.get("/users", auth, async (req, res) => {
  try {
    const q = String(req.query.search || "").trim();
    if (q.length < 1) return res.json({ success: true, users: [] });
    const users = await User.find({
      _id: { $ne: req.user._id },
      isDeactivated: { $ne: true },
      fullName: { $regex: q.slice(0, 60), $options: "i" }
    }).select("_id fullName profileImageURL isPrivate").limit(30).lean();
    res.json({ success: true, users });
  } catch (error) {
    console.error("chatlog api users:", error);
    res.status(500).json({ success: false, message: "Unable to search users" });
  }
});

router.post("/groups", auth, async (req, res) => {
  try {
    const name = String(req.body.name || "").trim().slice(0, 80);
    let ids = Array.isArray(req.body.participantIds) ? req.body.participantIds.map(String) : [];
    ids = [...new Set([String(req.user._id), ...ids])];
    if (!name) return res.status(400).json({ success: false, message: "Enter a group name" });
    if (ids.length < 3) return res.status(400).json({ success: false, message: "Select at least 2 other users" });
    if (ids.length > 50) return res.status(400).json({ success: false, message: "A group can have up to 50 members" });
    if (ids.some(id => !validId(id))) return res.status(400).json({ success: false, message: "Invalid member" });
    const users = await User.find({ _id: { $in: ids }, isDeactivated: { $ne: true } }).select("_id fullName profileImageURL blockedUsers").lean();
    if (users.length !== ids.length) return res.status(400).json({ success: false, message: "One or more users were not found" });
    const group = await Conversation.create({
      participants: ids,
      isGroup: true,
      groupName: name,
      groupAvatar: String(req.body.groupAvatar || "").trim().slice(0, 2048),
      admins: [req.user._id]
    });
    const populated = await Conversation.findById(group._id).populate("participants", "fullName profileImageURL isPrivate").lean();
    res.status(201).json({ success: true, conversation: populated });
  } catch (error) {
    console.error("create group:", error);
    res.status(500).json({ success: false, message: "Unable to create group" });
  }
});

router.get("/groups/:conversationId", auth, async (req, res) => {
  try {
    if (!validId(req.params.conversationId)) return res.status(400).json({ success: false, message: "Invalid group" });
    const group = await Conversation.findOne({ _id: req.params.conversationId, participants: req.user._id, isGroup: true }).populate("participants", "fullName profileImageURL isPrivate").lean();
    if (!group) return res.status(404).json({ success: false, message: "Group not found" });
    res.json({ success: true, conversation: group });
  } catch (error) {
    res.status(500).json({ success: false, message: "Unable to load group" });
  }
});

router.patch("/conversations/:conversationId/pin", auth, async (req, res) => {
  try {
    if (!validId(req.params.conversationId)) return res.status(400).json({ success: false, message: "Invalid conversation" });
    const c = await Conversation.findOne({ _id: req.params.conversationId, participants: req.user._id }).select("_id pinnedBy");
    if (!c) return res.status(404).json({ success: false, message: "Conversation not found" });
    const pinned = c.pinnedBy.some(x => String(x) === String(req.user._id));
    if (pinned) c.pinnedBy.pull(req.user._id); else c.pinnedBy.addToSet(req.user._id);
    await c.save();
    res.json({ success: true, pinned: !pinned });
  } catch (error) { res.status(500).json({ success: false, message: "Unable to update pin" }); }
});

router.patch("/conversations/:conversationId/mute", auth, async (req, res) => {
  try {
    if (!validId(req.params.conversationId)) return res.status(400).json({ success: false, message: "Invalid conversation" });
    const c = await Conversation.findOne({ _id: req.params.conversationId, participants: req.user._id }).select("_id mutedBy");
    if (!c) return res.status(404).json({ success: false, message: "Conversation not found" });
    const muted = c.mutedBy.some(x => String(x) === String(req.user._id));
    if (muted) c.mutedBy.pull(req.user._id); else c.mutedBy.addToSet(req.user._id);
    await c.save();
    res.json({ success: true, muted: !muted });
  } catch (error) { res.status(500).json({ success: false, message: "Unable to update mute" }); }
});

router.delete("/conversations/:conversationId", auth, async (req, res) => {
  try {
    if (!validId(req.params.conversationId)) return res.status(400).json({ success: false, message: "Invalid conversation" });
    const c = await Conversation.findOne({ _id: req.params.conversationId, participants: req.user._id }).select("_id hiddenFor");
    if (!c) return res.status(404).json({ success: false, message: "Conversation not found" });
    c.hiddenFor.addToSet(req.user._id);
    await c.save();
    res.json({ success: true, message: "Conversation deleted for you" });
  } catch (error) { res.status(500).json({ success: false, message: "Unable to delete conversation" }); }
});

module.exports = router;
