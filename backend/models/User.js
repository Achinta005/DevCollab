const mongoose =require("mongoose");
const bcrypt=require("bcryptjs");
const { type } = require("os");

const UserSchema=new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    firstname:{ type: String, required: true },
    lastname:{ type: String },
    email:{type:String ,required:true},
    password:{type:String,required:true},
    profile:{
        avatar:{type:String},
        bio :{type:String},
        skills:{type:String},
        experience:{type:String},
        github:{type:String},
        portfolio:{type:String},
        linkedin:{type:String},
    },
    preferences:{
        theme:{type:String},
        notification:{type:Object}
    },
    createdAt:{type:Date},
    LastActive:{type:Date}
},{
    timestamps:true
})

const User=mongoose.model("User",UserSchema);
module.exports=User