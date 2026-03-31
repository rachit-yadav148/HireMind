import { Router } from "express";
import * as auth from "../controllers/authController.js";
import { authRequired } from "../middleware/auth.js";

const r = Router();
r.post("/register", auth.register);
r.post("/login", auth.login);
r.get("/me", authRequired, auth.me);

export default r;
