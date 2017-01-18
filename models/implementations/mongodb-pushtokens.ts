import * as mongoose from "mongoose";
import PushTokens from "../pushtokens";
// Expose "PushTokens" interface to the database implementation
export {PushTokens as PushTokens};

interface MongoPushTokens extends PushTokens, mongoose.Document {}

const PushTokensSchema = new mongoose.Schema({
    application_id: {
        type: String,
        required: false
    },
    user_id: {
        type: String,
        required: false
    },
    token: {
        type: String,
        required: false
    },
    is_active: {
        type: Boolean,
        required: false
    },
    push_provider_code: {
        type: String,
        required: false
    },   
    created_time: {
        type: Date,
        required: false
    },
    updated_time: {
        type: Date,
        required: false
    } 
});

export const PushTokensModel = mongoose.model<MongoPushTokens>("pushtokens", PushTokensSchema, "pushtokens");

export default PushTokensModel;
