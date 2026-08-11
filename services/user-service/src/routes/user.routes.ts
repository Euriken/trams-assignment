import { Router, Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service.js';
import { validate } from '../middleware/validation.js';
import {
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
} from '@microservices/shared';

const router = Router();
const userService = new UserService();

// POST /users
router.post(
  '/',
  validate(createUserSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.createUser(req.body);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  }
);

// GET /users
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const result = await userService.getUsers(limit, offset);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /users/:id
router.get(
  '/:id',
  validate(userIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.getUserById(req.params.id);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

// PUT /users/:id
router.put(
  '/:id',
  validate(userIdParamSchema, 'params'),
  validate(updateUserSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await userService.updateUser(req.params.id, req.body);
      res.json(user);
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /users/:id
router.delete(
  '/:id',
  validate(userIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await userService.deleteUser(req.params.id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export { router as userRoutes };
