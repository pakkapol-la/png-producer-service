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

import { JSONRequest } from "./common/middlewares/json";
import { PushRestRequestBO } from "./bo/rest/pushrestrequestbo";
import * as messaging from "./adapters/messaging";


if(cluster.isMaster) {
    let numWorkers = Config.get<number>(
        "mpng-service",
        "worker-number",
        os.cpus().length
    );

    Logger.info('Master cluster setting up ' + numWorkers + ' workers...');

    for(var i = 0; i < numWorkers; i++) {
        cluster.fork();
    }

    cluster.on('online', function(worker) {
        Logger.info('Worker ' + worker.process.pid + ' is online');
    });

    cluster.on('exit', function(worker, code, signal) {
        Logger.info('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
        Logger.info('Starting a new worker');
        cluster.fork();
    });

} else {

    let app = express();

    let database: Database = new MongoDBDatabase({
        reconnectionTime: Config.get<number>(
            "mpng-service",
            "mongodb.reconnect-time",
            5000
        )
    });

    let server: Server;

    let broker: MessageBroker = new RabbitMQBroker(Config.get<string>(
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
                //app.use("/", Routes);
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

                app.post('/push/fcm', function (request, response) {
                    response.header("Content-Type", "application/json; charset=utf-8");
                    let jsonRequest = JSONRequest<PushRestRequestBO>(request);
                    //Logger.info(MainConst.logPattern(jsonRequest.request_id, "request : "+JSON.stringify(jsonRequest)));

                    let responseMessage = createResponseSuccess(MainConst.genResponseId()); 
                    //Logger.info(MainConst.logPattern(jsonRequest.request_id, "response : "+JSON.stringify(responseMessage)));
                    response.send(JSON.stringify(responseMessage));

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
                    
    }).catch(error => {
        Logger.error(`DBError: ${error}`);
    });

}    


function createResponseSuccess(message_id: string): PushRestResponseBO {
    let responseMessage = new PushRestResponseBO();    
    
    responseMessage.status = MainConst.StatusConstant.STATUS_SUCCESS; // 0 = success , 1 = fail    
    responseMessage.response_id = message_id;

    return responseMessage;
}

function createResponseError(error_code: string, ext_msg?: string): PushRestResponseBO {
    let responseMessage = new PushRestResponseBO();    
    let err_msg = MainConst.ErrorCode.getErrCode(error_code);

    responseMessage.status = MainConst.StatusConstant.STATUS_FAIL; // 0 = success , 1 = fail    
    responseMessage.error_code = err_msg.err_code;
    responseMessage.error_message = err_msg.err_msg;
    if (ext_msg) {
        responseMessage.error_message = responseMessage.error_message + " : " + ext_msg;
    }
    responseMessage.response_id = MainConst.genResponseId();
    //ref_id: uuid.v4(),
    return responseMessage;
}
