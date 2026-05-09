import { Router, type IRouter } from "express";
import healthRouter from "./health";
import maniRouter from "./mani";

const router: IRouter = Router();

router.use(healthRouter);
router.use(maniRouter);

export default router;
