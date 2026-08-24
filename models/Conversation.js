const mongoose=require("mongoose");
const conversationSchema=new mongoose.Schema({
  participants:[{type:mongoose.Schema.Types.ObjectId,ref:"user",required:true}],
  lastMessage:{type:mongoose.Schema.Types.ObjectId,ref:"Message",default:null},
  lastMessageAt:{type:Date,default:null},
  blockedBy:[{type:mongoose.Schema.Types.ObjectId,ref:"user"}],
  mutedBy:[{type:mongoose.Schema.Types.ObjectId,ref:"user"}],
  pinnedBy:[{type:mongoose.Schema.Types.ObjectId,ref:"user"}],
  hiddenFor:[{type:mongoose.Schema.Types.ObjectId,ref:"user"}],
  isGroup:{type:Boolean,default:false,index:true},
  groupName:{type:String,trim:true,maxlength:80,default:""},
  groupAvatar:{type:String,trim:true,maxlength:2048,default:""},
  admins:[{type:mongoose.Schema.Types.ObjectId,ref:"user"}]
},{timestamps:true});
conversationSchema.index({participants:1});
conversationSchema.index({participants:1,isGroup:1});
module.exports=mongoose.model("Conversation",conversationSchema);