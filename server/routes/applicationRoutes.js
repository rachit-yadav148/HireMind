import { Router } from "express";
import * as appCtrl from "../controllers/applicationController.js";
import { authRequired } from "../middleware/auth.js";

const r = Router();
r.use(authRequired);
r.get("/", appCtrl.list);
r.post("/", appCtrl.create);
r.patch("/:id", appCtrl.update);
r.delete("/:id", appCtrl.remove);

export default r;
