import { Router } from "express";

import PushFCMController from "../controllers/pushproducer-controller";
import * as JSON from "../common/middlewares/json";
import * as CircuitBreaker from "../common/middlewares/circuit-breaker";

const controller = new PushFCMController();
const router = Router();

router.route("/fcm").post(
    CircuitBreaker.require(controller.do.require),
    JSON.expect(controller.do.expectation),
    controller.do.action
);


export default router;
