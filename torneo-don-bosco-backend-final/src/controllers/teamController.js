import * as service from '../services/teamService.js';

export async function list(req, res, next) {
  try {
    res.json(await service.list(req.query));
  } catch (error) {
    next(error);
  }
}
export async function get(req, res, next) {
  try {
    res.json({ data: await service.get(req.params.id) });
  } catch (error) {
    next(error);
  }
}
export async function create(req, res, next) {
  try {
    res.status(201).json({ data: await service.create(req.body) });
  } catch (error) {
    next(error);
  }
}
export async function update(req, res, next) {
  try {
    res.json({ data: await service.update(req.params.id, req.body) });
  } catch (error) {
    next(error);
  }
}
export async function remove(req, res, next) {
  try {
    res.json(await service.remove(req.params.id));
  } catch (error) {
    next(error);
  }
}
