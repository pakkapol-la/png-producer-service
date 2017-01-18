import PushMessages from "../models/pushmessages";
import PushTokens from "../models/pushtokens";

interface Database {
    connect(url: string, options?: any): Promise<Database>;
    disconnect(): Promise<void>;    
    insertPushMessages(push_message: PushMessages): Promise<PushMessages>; 
    findPushtokesByUserId(user_id: string): Promise<PushTokens>;   
}

export default Database;
