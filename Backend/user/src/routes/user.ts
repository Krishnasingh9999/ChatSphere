import express from "express";
import { 
  addContact,
  getAllUsers, 
  getAUser, 
  getSavedContacts, 
  loginUser, 
  myProfile, 
  removeContact, 
  updateName, 
  verifyUser 
} from "../controllers/user.js";
import { isAuth } from "../middleware/isAuth.js";
import { upload } from "../middleware/multer.js";

const router = express.Router();

router.post('/login', loginUser);
router.post('/verify', verifyUser);
router.get('/me', isAuth, myProfile);
router.get('/user/all', isAuth, getAllUsers);
router.get('/user/contacts', isAuth, getSavedContacts);
router.post('/user/contact/:id', isAuth, addContact);
router.delete('/user/contact/:id', isAuth, removeContact);
router.get('/user/:id', getAUser);
router.post('/update/user', isAuth, upload.single('avatar'), updateName);
router.put('/update/user', isAuth, upload.single('avatar'), updateName);
router.post('/user/update', isAuth, upload.single('avatar'), updateName);
router.put('/user/update', isAuth, upload.single('avatar'), updateName);

export default router;