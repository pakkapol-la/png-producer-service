import { Router } from "express";

import * as FactoryService from "../common/factory-service";
import Heartbeat from "../common/heartbeat";
import PushFCMRoutes from "./pushfcm";

const router = Router();

router.use(Heartbeat);
router.use("/push", PushFCMRoutes);

export default router;

let factory_service: FactoryService.FactoryService;

export function setFactoryService(factory_service: FactoryService.FactoryService): void{
    this.factory_service = factory_service;
};

export function getFactoryService(): FactoryService.FactoryService{
    return this.factory_service;
};
