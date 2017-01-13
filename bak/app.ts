import Config from "./common/config";
import Logger from "./common/logger";
import * as express from "express";
import * as bodyParser from "body-parser";
import { Server } from "http";
import Routes from "./routes";
import Database from "./adapters/database";
import MongoDBDatabase from "./adapters/implementations/mongodb-database";

import * as MainConst from "./mainconstant";
import { PushRestResponseBO } from "./bo/rest/pushrestresponsebo";
import MessageBroker from "./adapters/messaging";
import RabbitMQBroker from "./adapters/implementations/rabbitmq-messaging";
import * as amqp from "amqplib";
import * as os from "os";
import * as cluster from "cluster";


//export let app = express();
let app = express();

export let database: Database = new MongoDBDatabase({
    reconnectionTime: Config.get<number>(
        "mpng-service",
        "mongodb.reconnect-time",
        5000
    )
});

export let server: Server;

//export let amqpConn: amqp.Connection;

export let broker: MessageBroker = new RabbitMQBroker(Config.get<string>(
        "push-notification-service",
        "rabbit-mq.q-online",
        ""
    ),Config.get<boolean>(
        "push-notification-service",
        "rabbit-mq.durable",
        true
    ),Config.get<boolean>(
        "push-notification-service",
        "rabbit-mq.persistent",
        true
    ),{
    reconnectionTime: Config.get<number>(
        "push-notification-service",
        "rabbit-mq.reconnect-time",
        5000
    )
});

if (process.env["NODE_ENV"] === "test") {
    Logger.info("Running on test environment...");
    //database = new MockDatabase();
}  

Promise.all([
    database.connect(
        Config.get<string>(
            "mpng-service",
            "mongodb.connection-url",
            "mongodb://127.0.0.1/myproject"
        )
    ),
    broker.connect(Config.get<string>(
                            "push-notification-service",
                            "rabbit-mq.q-url",
                            ""
                        ))
]).then(() => {

    return new Promise((resolve, reject) => {               

            app.use(bodyParser.json());
            app.use("/", Routes);
            app.use((
                error: any, request: express.Request, response: express.Response,
                next: express.NextFunction
            ) => {
                Logger.error("status 500 error : ", JSON.stringify(error));

                let responseMessage = new PushRestResponseBO();
                let err_msg = MainConst.ErrorCode.getErrCode(MainConst.ErrorCode.MPNG000.err_code);

                responseMessage.status = MainConst.StatusConstant.STATUS_FAIL; // 0 = success , 1 = fail    
                responseMessage.error_code = err_msg.err_code;
                responseMessage.error_message = "Internal server error. Please try again later. : " + err_msg.err_msg + " : " + JSON.stringify(error);
                responseMessage.response_id = MainConst.genResponseId();

                response.status(500).send(responseMessage);
                next();
            });

            let service_port = Config.getLocal<number>("mpng-service", "service-port", 3000);
            server = app.listen(service_port,
                () => {
                    //Logger.info("Server start on port ", service_port);
                    Logger.info('Process ' + process.pid + ' is listening to all incoming requests on port ', service_port);
                    return resolve(this);            
                });
        

    });
    
}).then(() => {
    /*
    this.amqpConn = AMQP.connect(Config.get<string>(
                            "push-notification-service",
                            "rabbit-mq.q-url",
                            ""
                        ));
    Logger.info("connect queue 1");    
    */  

    /*                  
    amqp.connect(Config.get<string>(
                            "push-notification-service",
                            "rabbit-mq.q-url",
                            ""
                        ), function(err: any, conn: amqp.Connection) {   
                            amqpConn = conn;                      
                            Logger.info("connect queue");  
                        });
     */              
}).catch(error => {
    Logger.error(`DBError: ${error}`);
});



