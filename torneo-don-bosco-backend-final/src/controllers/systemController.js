import { health as checkHealth } from '../services/systemService.js';
import { getStandings } from '../services/standingsService.js';

export async function health(req, res, next) {
  try {
    const data = await checkHealth();
    res.status(data.ok ? 200 : 503).json(data);
  } catch (error) {
    next(error);
  }
}
export async function standings(req, res, next) {
  try {
    res.json({ data: await getStandings(req.query) });
  } catch (error) {
    next(error);
  }
}
