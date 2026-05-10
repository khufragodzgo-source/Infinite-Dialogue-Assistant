import { Router, type IRouter } from "express";
import healthRouter from "./health";
import maniRouter from "./mani";
import authRouter from "./auth";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(authRouter);
router.use(adminRouter);
router.use(healthRouter);
router.use(maniRouter);

export default router;
