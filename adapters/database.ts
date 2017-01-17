import PushMessages from "../models/pushmessages";

interface Database {
    connect(url: string, options?: any): Promise<Database>;
    disconnect(): Promise<void>;    
    insertPushMessages(push_message: PushMessages): Promise<PushMessages>;   
}

export default Database;
