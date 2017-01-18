import Config from "../common/config";
import * as express from "express";
import * as uuid from "uuid";
import { JSONRequest } from "../common/middlewares/json";
import Request from "../common/request";
import Logger from "../common/logger";

import * as MainConst from "../common/mainconstant";
import { PushRestRequestBO } from "../bo/rest/pushrestrequestbo";
import { ParamPushBO } from "../bo/push/parampushbo";
import { PushRestResponseBO } from "../bo/rest/pushrestresponsebo";
import { RequestFCMBO } from "../bo/fcm/requestfcmbo";
import { NotificationBO } from "../bo/fcm/notificationbo";
import * as messaging from "../adapters/messaging";
import * as Routes from "../routes";

import PushMessages from "../models/pushmessages";

export default class PushFCMController {

    delay = 10;

    do = {
        //require: [],
        require: ["db"],
        expectation: {
            "request_id": {
                "type": "^[0-9a-zA-Z\-]+$",
                "mismatch": (
                    "request_id must be a string or number"
                ),
                "invalid": "request_id is invalid",
                "required": "request_id is required"
            }/*
            "app_id": {
                "type": "^[0-9a-zA-Z\-]+$",
                "mismatch": (
                    "app id must be a string or number"
                ),
                "invalid": "app id is invalid",
                "required": "app id is required"
            },
            "body_msg": {
                "type": "^[0-9a-zA-Z\-\\]+$",
                "mismatch": (
                    "body msg must be a string or number"
                ),
                "invalid": "body msg is invalid",
                "required": "body msg is required"
            }*/
        },
        action: (request: express.Request, response: express.Response) => {
            
            try {
                response.header("Content-Type", "application/json; charset=utf-8");
                let jsonRequest = JSONRequest<PushRestRequestBO>(request);
                Logger.info(MainConst.logPattern(jsonRequest.request_id, process.pid, "request : "+JSON.stringify(jsonRequest)));

                if (validateParam(request, response)) {
                                    
                    //will check platform android by app_id , ios for set some field special for each platform
                    // and get server key depend by app_id ,  get token by user_id 

                    Routes.getFactoryService().db_service.findPushtokesByUserId(jsonRequest.user_id).then(push_tokens_document => {
                   
                        let msg_obj: messaging.MessageContent = preparePushMsg(jsonRequest, push_tokens_document.token, push_tokens_document.push_provider_code);                   

                        let msg_db = prepareDBMsg(jsonRequest, msg_obj);

                        Routes.getFactoryService().db_service.insertPushMessages(msg_db).then(push_message_document => {
                            
                            if (push_message_document.id) {
                                msg_obj.record_id = push_message_document.id;
                            }
                            
                            Routes.getFactoryService().message_broker.publishMessage(msg_obj).then(broker_resp_id => {                                              
                                let responseMessage = createResponseSuccess(msg_obj.response_id); 
                                Logger.info(MainConst.logPattern(jsonRequest.request_id, process.pid, "response : "+JSON.stringify(responseMessage)));
                                response.send(JSON.stringify(responseMessage));
                            }).catch(error => {                        
                                let responseMessage = createResponseError(jsonRequest.request_id, MainConst.ErrorCode.MPNG001.err_code, error.toString()) as PushRestResponseBO;
                                Logger.info(MainConst.logPattern(jsonRequest.request_id, process.pid, "response : "+JSON.stringify(responseMessage)));
                                response.send(JSON.stringify(responseMessage));           
                            });

                        }).catch(error => {
                            let responseMessage = createResponseError(jsonRequest.request_id, MainConst.ErrorCode.MPNG001.err_code, error.toString()) as PushRestResponseBO;
                            Logger.info(MainConst.logPattern(jsonRequest.request_id, process.pid, "response : "+JSON.stringify(responseMessage)));
                            response.send(JSON.stringify(responseMessage));  
                        });

                    }).catch(error => {
                        let responseMessage = createResponseError(jsonRequest.request_id, MainConst.ErrorCode.MPNG007.err_code, error.toString()) as PushRestResponseBO;
                        Logger.info(MainConst.logPattern(jsonRequest.request_id, process.pid, "response : "+JSON.stringify(responseMessage)));
                        response.send(JSON.stringify(responseMessage));    
                    });
        

                }
            } catch(err) {
                 throw err;
            }

        }
    };
};


function prepareDBMsg(jsonRequest: PushRestRequestBO, message_content: messaging.MessageContent): PushMessages{
    let push_message = {
            request_id: message_content.request_id,
            application_id: jsonRequest.application_id,
            user_id: jsonRequest.user_id,
            started_time: new Date(),
            //put_time: new Date(),
            //pulled_time: new Date(),  
            //sent_time: new Date(),
            //elapsed: 123,
            status: 2, //in process
            interface_type: jsonRequest.interface_type,
            message_type: parseInt(jsonRequest.message_type),
            worker_id: process.pid.toString(),
            push_provider_code: message_content.platform,
            push_token_id: message_content.content.to,
            push_message: message_content.content
        } as PushMessages;

    return push_message;
}


function preparePushMsg(rest_req: PushRestRequestBO, push_token: string, platform: string): messaging.MessageContent {
    
    let push_message: ParamPushBO = rest_req.push_message;

    let req_push = new RequestFCMBO();
    /*
    let platform: string = "";
    
    //this section is mock
    if (rest_req.application_id) {
        if ("gap" == rest_req.application_id) {
            req_push.to = Config.get<string>(
                "mock-app-id-set",
                "gap.token",
                ""
            );
            platform = Config.get<string>(
                "mock-app-id-set",
                "gap.platform",
                ""
            );
        } else if ("rit" == rest_req.application_id) {
            req_push.to = Config.get<string>(
                "mock-app-id-set",
                "rit.token",
                ""
            );
            platform = Config.get<string>(
                "mock-app-id-set",
                "rit.platform",
                ""
            );
        } else {
            //mock hard rit token
            req_push.to = "dicxg4dMp5Y:APA91bGTIHN6U2ztIarHJa4ONpIuH11JcYG7DnpWDPcVz_Lfj324ARTHDNSE2M0oUs8Basin0YovbGbMcbwKGDo1gy4KuXufqEQp3EpSO0aRWWJgTFi4_XPOUKQw7vo-FqUmK6TebryG";
            platform = MainConst.PlatformConstant.IOS;
        }
    } else {
        //mock hard rit token
        req_push.to = "dicxg4dMp5Y:APA91bGTIHN6U2ztIarHJa4ONpIuH11JcYG7DnpWDPcVz_Lfj324ARTHDNSE2M0oUs8Basin0YovbGbMcbwKGDo1gy4KuXufqEQp3EpSO0aRWWJgTFi4_XPOUKQw7vo-FqUmK6TebryG";
        platform = MainConst.PlatformConstant.IOS;
    }
    //end this section is mock
    */

    req_push.to = push_token;
   
    let notification = new NotificationBO();

    if (push_message.title) {
        notification.title = push_message.title;
    }

    let body_msg = push_message.body_message
    notification.body = body_msg;

    if (push_message.icon) {
        notification.icon = push_message.icon;
    }
    if (push_message.color) {
        notification.color = push_message.color;
    }

    if(platform == MainConst.PlatformConstant.IOS){
        if(push_message.badge){ //for ios
            notification.badge = push_message.badge;
        }
    }

    if (push_message.tag) {
        notification.tag = push_message.tag;
    }
    if (push_message.sound) {
        notification.sound = push_message.sound;
    }
    if (push_message.tag) {
        notification.tag = push_message.tag;
    }

    req_push.notification = notification;

    if (push_message.content_available) {
        req_push.content_available = push_message.content_available;
    } else {
        req_push.content_available = true;
    }

    if (push_message.collapse_key) {
        req_push.collapse_key = push_message.collapse_key;
    }
    if (push_message.collapse_key) {
        req_push.collapse_key = push_message.collapse_key;
    }
    if (push_message.priority && RequestFCMBO.PRIORITY_HIGH == push_message.priority) {
        req_push.priority = RequestFCMBO.PRIORITY_HIGH;
    } else {
        req_push.priority = RequestFCMBO.PRIORITY_NORMAL;
    }

    req_push.delay_while_idle = true;

    if (push_message.time_to_live) {
        req_push.time_to_live = push_message.time_to_live;
    }

    let dry_run: boolean = Config.get<boolean>(
            "push-notification-service",
            "fcm-service.dry-run",
            false
        );
    if (dry_run) {
        req_push.dry_run = dry_run;
    }

    let dataPayload: {[key: string]: string} = {};
    if (push_message.data) {
        dataPayload = push_message.data;
    }
    dataPayload[RequestFCMBO.DATA_PAYLOAD_KEY_MESSAGE] = body_msg;

    req_push.data = dataPayload;

    let msg_obj = {        
        request_id: rest_req.request_id,
        response_id: MainConst.genResponseId(),
        platform: platform,
        content: req_push,
        server_key: Config.get<string>(
                        "push-notification-service",
                        "fcm-service.api-key",
                        ""
                    )
    } as messaging.MessageContent;

    return msg_obj;    

}


function createResponseSuccess(message_id: string): PushRestResponseBO {
    let responseMessage = new PushRestResponseBO();    
    
    responseMessage.status = MainConst.StatusConstant.STATUS_SUCCESS; // 0 = success , 1 = fail    
    responseMessage.response_id = message_id;

    return responseMessage;
}


function createResponseError(request_id: string, error_code: string, ext_msg?: string): PushRestResponseBO {
    let responseMessage = new PushRestResponseBO();    
    let err_msg = MainConst.ErrorCode.getErrCode(error_code);

    responseMessage.request_id = request_id;
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


function validateParam(request: express.Request, response: express.Response): boolean {
    let jsonRequest = JSONRequest<PushRestRequestBO>(request);
    let responseMessage = new PushRestResponseBO();
    let is_false: boolean = false;

    if (jsonRequest.push_message) {
        let data_push: ParamPushBO = jsonRequest.push_message;

        if (is_false == false && !jsonRequest.user_id) {
            responseMessage = createResponseError(MainConst.ErrorCode.MPNG002.err_code, "user_id is required") as PushRestResponseBO;           
            is_false = true;          
        }

        if (is_false == false && !jsonRequest.application_id) {
            responseMessage = createResponseError(MainConst.ErrorCode.MPNG002.err_code, "application_id is required") as PushRestResponseBO;           
            is_false = true;          
        }
        /*
        if (is_false == false && !data_push.body_msg) {
            responseMessage = createResponseError(MainConst.ErrorCode.MPNG002.err_code, "body msg is required") as PushRestResponseBO;           
            is_false = true;         
        }
        */
    } else {        
        responseMessage = createResponseError(jsonRequest.request_id, MainConst.ErrorCode.MPNG005.err_code) as PushRestResponseBO;
        is_false = true;   
    }

    if(is_false == true){
        Logger.info(MainConst.logPattern(jsonRequest.request_id, process.pid, "response : "+JSON.stringify(responseMessage)));
        response.send(JSON.stringify(responseMessage)); 
        return false;      
    }

    return true;
}