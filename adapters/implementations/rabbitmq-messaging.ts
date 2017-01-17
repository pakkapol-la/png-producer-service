import Config from "../../common/config";
import * as bluebird from "bluebird";
import * as amqp from "amqplib";
import CircuitBreaker from "../../common/circuit-breaker";
import * as messaging from "../messaging";

import Logger from "../../common/logger";
import * as MainConst from "../../common/mainconstant";
import { RequestFCMBO } from "../../bo/fcm/requestfcmbo";
import { ResponseFCMBO } from "../../bo/fcm/responsefcmbo";
import { ResultBO } from "../../bo/fcm/result";
import { NotificationBO } from "../../bo/fcm/notificationbo";

export interface RabbitMQOptions {
    reconnectionTime?: number;
}

export class RabbitMQBroker implements messaging.MessageBroker {
    private options: RabbitMQOptions = {};

    private connection: amqp.Connection | null = null;
    private channel: amqp.Channel | null = null;

    private qname: string;
    private durable: boolean;
    private persistent: boolean;

    constructor(qname: string, durable: boolean, persistent: boolean, options?: RabbitMQOptions) {
        if (options) {
            this.options = options;
        }
        this.qname = qname;
        this.durable = durable;
        this.persistent = persistent;
    }

    connect(url: string, options?: any) {
        return new Promise<RabbitMQBroker>((resolve, reject) => {
            amqp.connect(url, options)
                .then(connection => {
                    this.connection = connection;  
                    this.createChannel().then(channel => {
                         this.channel = channel;                         
                         CircuitBreaker.reportState("broker", "close");
                         Logger.info(MainConst.logPatternProcessId(process.pid, "Queue Connect on " + url));  
                         return resolve(this);
                    });                  
                    
                    connection.on("error", (error: any) => {
                        connection.close();
                        this.connection = null;
                        CircuitBreaker.reportState("broker", "open");
                        return bluebird.delay(
                            this.options.reconnectionTime || 5000
                        ).then(() => {
                            return this.connect(url, options);
                        });
                    });
                   
                })
                .catch(error => {
                    this.connection = null;
                    CircuitBreaker.reportState("broker", "open");
                    return bluebird.delay(
                        this.options.reconnectionTime || 5000
                    ).then(() => {
                        return this.connect(url, options);
                    }).then(broker => {
                        return resolve(broker);
                    });
                });
        });
    }

    disconnect() {
        return new Promise<void>((resolve, reject) => {
            if (!this.connection) {
                return resolve();
            }
            this.connection.close()
                .then(() => {
                    this.connection = null;
                    CircuitBreaker.reportState("broker", "open");
                    return resolve();
                })
                .catch(error => {
                    return reject(new Error(`MessageBrokerError: ${error.toString()}`));
                });
        });
    }

    createChannel(): Promise<amqp.Channel> {
        return new Promise<amqp.Channel>((resolve, reject) => {
            if (!this.connection) {
                return reject(new Error(`MessageChannelError: connection error`));
            }
            this.connection.createChannel()
                .then(channel => {
                    channel.assertQueue(this.qname, { durable: this.durable });

                    this.channel = channel;                                
                    CircuitBreaker.reportStatus("broker", true);
                    channel.on("error", (error: any) => {
                        channel.close();
                        this.channel = null;
                        CircuitBreaker.reportState("broker", "open");
                        return bluebird.delay(
                            this.options.reconnectionTime || 5000
                        ).then(() => {
                            return this.createChannel();
                        });
                    });

                    return resolve(this.channel);
                })
                .catch(error => {
                    this.channel = null;
                    CircuitBreaker.reportState("broker", "open");
                    return bluebird.delay(
                        this.options.reconnectionTime || 5000
                    ).then(() => {
                        return this.createChannel();
                    });
                });
        });
    }
   

    publishMessage(msgObj: messaging.MessageContent) {
        return new Promise<string>((resolve, reject) => {
            if (!this.connection) {
                return reject(new Error(`MessageChannelError: connection error`));
            }
                      
            
            if(this.channel){
                this.channel.sendToQueue(this.qname, new Buffer(JSON.stringify(msgObj)), { persistent: this.persistent });
                Logger.info(MainConst.logPattern(msgObj.request_id, process.pid, "MessageBroker Sender : " + JSON.stringify(msgObj)));
                return resolve(msgObj.response_id);               
            } else {
                return reject("Process " + process.pid + " channel is null");
            }

           

            /*
            this.createChannel()
                .then(channel => {
                                      
                    channel.sendToQueue(this.qname, new 
                    Buffer(JSON.stringify(msgObj)), { persistent: this.persistent });
                    Logger.info(MainConst.logPattern(msgObj.request_id, "MessageBroker Send : "+JSON.stringify(msgObj)));
                    return resolve(msgObj.response_id);
                   
                    /*
                    return new Promise<string>((resolve, reject) => {

                        //channel.sendToQueue(this.qname, new Buffer(JSON.stringify(msgObj)), { persistent: true });
                        channel.sendToQueue(this.qname, new Buffer(JSON.stringify(msgObj)));
                        Logger.info(MainConst.logPattern(msgObj.request_id, "MessageBroker Send : "+JSON.stringify(msgObj)));
                        return resolve(msgObj.response_id);
                    });
                    /
                }).catch(error => {
                    return reject(new Error(`MessageBrokerError: ${error.toString()}`));
                });
                */
              
        });
    }
};

export default RabbitMQBroker;
