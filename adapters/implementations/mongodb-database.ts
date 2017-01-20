import * as bluebird from "bluebird";
import * as mongoose from "mongoose";
import Config from "../../common/config";
import CircuitBreaker from "../../common/circuit-breaker";
import Database from "../database";
import {PushMessages, PushMessagesModel} from "../../models/implementations/mongodb-pushmessages";
import {PushTokens, PushTokensModel} from "../../models/implementations/mongodb-pushtokens";
import Logger from "../../common/logger";


interface MongoDBOptions {
    reconnectionTime?: number;
}

export default class MongoDBDatabase implements Database {
    private error: any = "not connected";
    private options: MongoDBOptions = {};

    constructor(options?: MongoDBOptions){
        (mongoose as any).Promise = bluebird;
        if(options){
            this.options = options;
        }
    }

    connect(url: string, options?: any){
        return new Promise<MongoDBDatabase>((resolve, reject) => {
            mongoose.connect(url, options)
                .then(() => {
                    this.error = null;
                    Logger.info('mongoose.connected.......');
                    Logger.info('CircuitBreaker.reportState...close....');
                    CircuitBreaker.reportState("db", "close");
                    mongoose.connection.on("error", (error: any) => {
                        mongoose.connection.db.close();
                        this.error = error;
                        CircuitBreaker.reportState("db", "open");
                        return bluebird.delay(
                            this.options.reconnectionTime || 5000
                        ).then(() => {
                            return this.connect(url, options);
                        });
                    });
                    return resolve(this);
                })
                .catch(error => {
                    this.error = error;
                    Logger.info('mongoose.connect error.......' + error);
                    Logger.info('CircuitBreaker.reportState...open....');
                    CircuitBreaker.reportState("db", "open");
                    return bluebird.delay(
                        this.options.reconnectionTime || 5000
                    ).then(() => {
                        return this.connect(url, options);
                    });
                });
        });
    }

    disconnect(){
        return new Promise<void>((resolve, reject) => {
            mongoose.disconnect()
                .then(() => {
                    this.error = "not connected";
                    Logger.info('mongoose.disconnect');
                    Logger.info('CircuitBreaker.reportState...open....');
                    CircuitBreaker.reportState("db", "open");
                    return resolve();
                })
                .catch(error => {
                    //return reject(new Error(`DBError: ${error}`));
                    return reject(error);
                });
        });
    }

    
    insertPushMessages(push_message: PushMessages){
        return new Promise<PushMessages>((resolve, reject) => {
            /*
            if (this.error) {
                return reject(`DBError: ${this.error}`);
            }
            */
            let pushmessages_model = new PushMessagesModel();

            pushmessages_model.request_id = push_message.request_id;
            pushmessages_model.application_id = push_message.application_id;
            pushmessages_model.user_id = push_message.user_id;
            pushmessages_model.started_time = push_message.started_time;
            //pushmessages_model.put_time = push_message.put_time;
            //pushmessages_model.pulled_time = push_message.pulled_time; 
            //pushmessages_model.sent_time = push_message.sent_time;
            //pushmessages_model.received_time = push_message.received_time;
            //pushmessages_model.elapsed = push_message.elapsed;
            pushmessages_model.status = push_message.status;
            pushmessages_model.interface_type = push_message.interface_type;
            pushmessages_model.message_type = push_message.message_type;
            pushmessages_model.worker_id = push_message.worker_id;
            pushmessages_model.push_provider_code = push_message.push_provider_code;
            pushmessages_model.push_token_id = push_message.push_token_id;
            pushmessages_model.push_message = push_message.push_message;
           
            /*
            pushmessages_model.save(function(error: any){
                 if (error) {
                    return reject(`DBError save : ${error}`);
                }
                Logger.info('pushmessages_model._id = '+pushmessages_model._id);

                return resolve(pushmessages_model);
            })
            */

            
            pushmessages_model.save().then(push_message_document => {                
                push_message_document.id = push_message_document._id;
                return resolve(push_message_document);
            })
            .catch(error => {
                //return reject(`DBError: ${error}`);
                return reject(error);
            });
            
            
        });
    }


    findPushtokesByUserId(user_id: string){
        return new Promise<PushTokens>((resolve, reject) => {
            if(this.error){
                return reject(new Error(`DBError: ${this.error}`));
            }
            /*
            PushTokensModel.find()
                .then(PushTokensList => {
                    return resolve(PushTokensList);
                })
                .catch(error => {
                    return reject(new Error(`DBError: ${error}`));
                });
            */
            
            PushTokensModel.findOne({user_id: user_id}, function(err, document) {
                if(err){
                    //return reject(new Error(`DBError: ${err}`));
                    return reject(err);
                }
                return resolve(document);
            });    

        });
    }

}
