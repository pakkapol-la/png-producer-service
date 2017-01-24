import PushMessages from "../models/pushmessages";
import PushTokens from "../models/pushtokens";

interface Database {
    connect(url: string, options?: any): Promise<Database>;
    disconnect(): Promise<void>;    
    insertPushMessages(push_message: PushMessages): Promise<PushMessages>; 
    findPushtokesByUserIdAndApplicationId(user_id: string, application_id: string): Promise<PushTokens>;   
}

export default Database;
