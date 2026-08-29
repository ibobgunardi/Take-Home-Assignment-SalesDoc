import { Router } from 'express';
import * as sessionStore from '../store/sessions.js';
import {
  createDialerSession,
  startSession,
  stopSession,
} from '../services/dialer.js';
import { sessionView } from '../views/session-view.js';
import { NotFoundError } from '../services/errors.js';

export const sessionsRouter = Router();

function loadSession(req, res, next) {
  const session = sessionStore.get(req.params.id);
  if (!session) return next(new NotFoundError(`Unknown session: ${req.params.id}`));
  req.session = session;
  return next();
}

sessionsRouter.post('/sessions', (req, res, next) => {
  try {
    const { agentId, leadIds } = req.body ?? {};
    const session = createDialerSession({ agentId, leadIds });
    res.status(201).json(sessionView(session));
  } catch (err) {
    next(err);
  }
});

/** The polling endpoint (R-67). One request renders one consistent tick. */
sessionsRouter.get('/sessions/:id', loadSession, (req, res) => {
  res.json(sessionView(req.session));
});

sessionsRouter.post('/sessions/:id/start', loadSession, (req, res, next) => {
  try {
    res.json(sessionView(startSession(req.session)));
  } catch (err) {
    next(err);
  }
});

sessionsRouter.post('/sessions/:id/stop', loadSession, (req, res) => {
  res.json(sessionView(stopSession(req.session)));
});
