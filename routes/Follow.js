const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const User = require("../models/user");
const FollowRequest = require("../models/FollowRequest");
const { restrictToLoggedInUserOnly } = require("../middlewares/authentication");
const NotificationService = require("../services/notificationService");

router.use(restrictToLoggedInUserOnly);

function validObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

async function notifyRequest(recipient, requester, requestId) {
  try {
    await NotificationService.createNotification(recipient._id, "follow_request", {
      title: "Follow request",
      message: `${requester.fullName} wants to follow you`,
      actor: requester._id,
      request: requestId
    });
  } catch (e) {
    console.error("Follow notification error:", e.message);
  }
}

async function notifyAccepted(requester, recipient) {
  try {
    await NotificationService.createNotification(requester._id, "follow_request_accepted", {
      title: "Follow request accepted",
      message: `${recipient.fullName} accepted your follow request`,
      actor: recipient._id
    });
  } catch (e) {
    console.error("Follow acceptance notification error:", e.message);
  }
}

// Keep the two sides of a follow relationship synchronized. $addToSet makes
// this safe to call repeatedly and prevents duplicate ObjectIds.
async function syncFollow(requesterId, recipientId) {
  await Promise.all([
    User.findByIdAndUpdate(requesterId, { $addToSet: { following: recipientId } }),
    User.findByIdAndUpdate(recipientId, { $addToSet: { followers: requesterId } })
  ]);
}

// Count only user documents that still exist. This prevents stale ObjectIds
// in followers/following arrays from making profile counts disagree with lists.
async function countsFor(userId) {
  const user = await User.findById(userId).select("followers following").lean();
  if (!user) return { followerCount: 0, followingCount: 0 };

  const followerIds = Array.isArray(user.followers) ? user.followers : [];
  const followingIds = Array.isArray(user.following) ? user.following : [];

  const [followerCount, followingCount] = await Promise.all([
    User.countDocuments({ _id: { $in: followerIds } }),
    User.countDocuments({ _id: { $in: followingIds } })
  ]);

  return { followerCount, followingCount };
}

router.post("/:userId/follow", async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id.toString();
    if (!validObjectId(userId)) return res.status(400).json({ success: false, message: "Invalid user" });
    if (userId === currentUserId) return res.status(400).json({ success: false, message: "Cannot follow yourself" });

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId),
      User.findById(userId)
    ]);
    if (!currentUser || !targetUser) return res.status(404).json({ success: false, message: "User not found" });
    if (currentUser.isDeactivated || targetUser.isDeactivated) return res.status(404).json({ success: false, message: "User not found" });

    if (currentUser.isFollowing(userId)) {
      await Promise.all([
        User.findByIdAndUpdate(currentUserId, { $pull: { following: userId } }),
        User.findByIdAndUpdate(userId, { $pull: { followers: currentUserId } }),
        FollowRequest.deleteMany({ requester: currentUserId, recipient: userId, status: "pending" })
      ]);
      const [meCounts, targetCounts] = await Promise.all([countsFor(currentUserId), countsFor(userId)]);
      return res.json({ success: true, following: false, requested: false, followerCount: targetCounts.followerCount, followingCount: meCounts.followingCount, message: "Unfollowed successfully" });
    }

    if (targetUser.isPrivate) {
      const existing = await FollowRequest.findOne({ requester: currentUserId, recipient: userId });
      if (existing?.status === "accepted") {
        await syncFollow(currentUserId, userId);
        const [meCounts, targetCounts] = await Promise.all([countsFor(currentUserId), countsFor(userId)]);
        return res.json({ success: true, following: true, requested: false, followerCount: targetCounts.followerCount, followingCount: meCounts.followingCount, message: "Already following" });
      }
      if (existing?.status === "pending") {
        const [meCounts, targetCounts] = await Promise.all([countsFor(currentUserId), countsFor(userId)]);
        return res.json({ success: true, following: false, requested: true, followerCount: targetCounts.followerCount, followingCount: meCounts.followingCount, message: "Follow request already pending" });
      }

      const request = await FollowRequest.findOneAndUpdate(
        { requester: currentUserId, recipient: userId },
        { $set: { status: "pending", respondedAt: null } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      await notifyRequest(targetUser, currentUser, request._id);
      const [meCounts, targetCounts] = await Promise.all([countsFor(currentUserId), countsFor(userId)]);
      return res.json({ success: true, following: false, requested: true, followerCount: targetCounts.followerCount, followingCount: meCounts.followingCount, message: "Follow request sent" });
    }

    await syncFollow(currentUserId, userId);

    try {
      await NotificationService.createNotification(userId, "follow", {
        title: "New follower",
        message: `${currentUser.fullName} started following you`,
        actor: currentUserId
      });
    } catch (e) {}

    const [meCounts, targetCounts] = await Promise.all([countsFor(currentUserId), countsFor(userId)]);
    return res.json({ success: true, following: true, requested: false, followerCount: targetCounts.followerCount, followingCount: meCounts.followingCount, message: "Followed successfully" });
  } catch (error) {
    console.error("Follow error:", error);
    return res.status(500).json({ success: false, message: "Failed to update follow status" });
  }
});

router.post("/:userId/remove-follower", async (req, res) => {
  try {
    if (!validObjectId(req.params.userId)) return res.status(400).json({ success: false, message: "Invalid user" });
    const target = await User.findById(req.params.userId);
    if (!target) return res.status(404).json({ success: false, message: "User not found" });
    const me = await User.findById(req.user._id).select("followers").lean();
    const wasFollower = !!me?.followers?.some(id => id.toString() === target._id.toString());
    await Promise.all([
      User.findByIdAndUpdate(req.user._id, { $pull: { followers: target._id } }),
      User.findByIdAndUpdate(target._id, { $pull: { following: req.user._id } })
    ]);
    const counts = await countsFor(req.user._id);
    return res.json({ success: true, ...counts, removed: wasFollower, message: `${target.fullName} removed from your followers` });
  } catch (e) {
    console.error("Remove follower error:", e);
    return res.status(500).json({ success: false, message: "Unable to remove follower" });
  }
});

router.post("/requests/:requestId/accept", async (req, res) => {
  try {
    if (!validObjectId(req.params.requestId)) return res.status(400).json({ success: false, message: "Invalid follow request" });

    const request = await FollowRequest.findOne({
      _id: req.params.requestId,
      recipient: req.user._id,
      status: "pending"
    });
    if (!request) return res.status(404).json({ success: false, message: "Follow request not found or already handled" });

    const [requester, recipient] = await Promise.all([
      User.findById(request.requester).select("_id fullName isDeactivated"),
      User.findById(request.recipient).select("_id fullName isDeactivated")
    ]);
    if (!requester || requester.isDeactivated || !recipient || recipient.isDeactivated) {
      await FollowRequest.findByIdAndUpdate(request._id, { $set: { status: "rejected", respondedAt: new Date() } });
      return res.status(404).json({ success: false, message: "User is no longer available" });
    }

    // First synchronize both user documents, then mark the request accepted.
    // This avoids the old state where the request was accepted but the
    // requester/recipient follower arrays were not both updated.
    await syncFollow(request.requester, request.recipient);
    await FollowRequest.findByIdAndUpdate(request._id, {
      $set: { status: "accepted", respondedAt: new Date() }
    });
    await notifyAccepted(requester, recipient);

    const [myCounts, requesterAfter] = await Promise.all([
      countsFor(req.user._id),
      User.findById(request.requester).select("following").lean()
    ]);
    const following = !!requesterAfter?.following?.some(id => id.toString() === request.recipient.toString());

    return res.json({
      success: true,
      accepted: true,
      following,
      requested: false,
      followerCount: myCounts.followerCount,
      followingCount: myCounts.followingCount,
      requestId: request._id,
      message: "Follow request accepted"
    });
  } catch (error) {
    console.error("Accept follow request error:", error);
    return res.status(500).json({ success: false, message: "Failed to accept request" });
  }
});

router.post("/requests/:requestId/reject", async (req, res) => {
  try {
    if (!validObjectId(req.params.requestId)) return res.status(400).json({ success: false, message: "Invalid follow request" });
    const request = await FollowRequest.findOneAndUpdate(
      { _id: req.params.requestId, recipient: req.user._id, status: "pending" },
      { $set: { status: "rejected", respondedAt: new Date() } },
      { new: true }
    );
    if (!request) return res.status(404).json({ success: false, message: "Follow request not found or already handled" });
    return res.json({ success: true, rejected: true, requestId: request._id, message: "Follow request rejected" });
  } catch (error) {
    console.error("Reject follow request error:", error);
    return res.status(500).json({ success: false, message: "Failed to reject request" });
  }
});

router.get("/requests/page", (req, res) => res.render("followRequests", { user: req.user }));

router.get("/requests", async (req, res) => {
  try {
    const requests = await FollowRequest.find({ recipient: req.user._id, status: "pending" })
      .sort({ createdAt: -1 })
      .populate("requester", "fullName profileImageURL bio")
      .lean();

    // Deleted users can leave old request documents behind. Do not send
    // null requesters to the browser, where they would break rendering.
    const safeRequests = requests.filter(request => request.requester);
    return res.json({ success: true, requests: safeRequests });
  } catch (error) {
    console.error("Fetch follow requests error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch follow requests" });
  }
});

async function paginatedPeople(req, res, field) {
  try {
    const page = Math.max(1, parseInt(req.query.page || 1, 10) || 1);
    if (!validObjectId(req.params.userId)) return res.status(400).json({ success: false, message: "Invalid user" });
    const user = await User.findById(req.params.userId).select(`followers following isPrivate`).lean();
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    const viewerId = req.user._id.toString();
    const allowed = user._id.toString() === viewerId || !user.isPrivate || user.followers.some(id => id.toString() === viewerId);
    if (!allowed) return res.status(403).json({ success: false, message: `${field === "followers" ? "Followers" : "Following"} list is private`, private: true });

    const ids = Array.isArray(user[field]) ? user[field] : [];
    const validUsers = ids.length
      ? await User.find({ _id: { $in: ids } }).select("fullName profileImageURL bio").lean()
      : [];
    const order = new Map(ids.map((id, i) => [id.toString(), i]));
    validUsers.sort((a, b) => order.get(a._id.toString()) - order.get(b._id.toString()));

    const total = validUsers.length;
    const pagePeople = validUsers.slice((page - 1) * 20, page * 20);

    return res.json({
      success: true,
      [field]: pagePeople,
      total,
      pages: Math.max(Math.ceil(total / 20), 1),
      page
    });
  } catch (error) {
    console.error(`Fetch ${field} error:`, error);
    return res.status(500).json({ success: false, message: `Failed to fetch ${field}` });
  }
}

router.get("/:userId/followers", (req, res) => paginatedPeople(req, res, "followers"));
router.get("/:userId/following", (req, res) => paginatedPeople(req, res, "following"));

module.exports = router;
