const mongoose=require('mongoose');
const dotenv=require('dotenv');
dotenv.config();

const connectMongoDB =async ()=>{
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected')
    } catch (error) {
        console.error('MongoDB connection error:',error.message);
        process.exit(1);
    }
;
}

module.exports= connectMongoDB