import * as service from '../services/userService.js';

export async function register(req, res, next) {
  try {
    res.status(201).json({ data: await service.register(req.body) });
  } catch (error) {
    next(error);
  }
}
export async function login(req, res, next) {
  try {
    res.json(await service.login(req.body));
  } catch (error) {
    next(error);
  }
}
export function me(req, res) {
  res.json({ data: req.user });
}
export async function list(req, res, next) {
  try {
    res.json(await service.list(req.query));
  } catch (error) {
    next(error);
  }
}
export async function updateAccess(req, res, next) {
  try {
    res.json({ data: await service.updateAccess(req.params.id, req.body, req.user._id) });
  } catch (error) {
    next(error);
  }
}
