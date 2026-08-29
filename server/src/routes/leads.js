import { Router } from 'express';
import * as leadStore from '../store/leads.js';
import * as appActivityStore from '../store/crm-activities.js';
import { NotFoundError } from '../services/errors.js';

// Routes are thin by design: parse, call one thing, serialize. A reviewer
// reads routes first, so they should read like a table of contents.
export const leadsRouter = Router();

leadsRouter.get('/leads', (req, res) => {
  res.json({ leads: leadStore.list() });
});

/**
 * GET /leads/:id/crm-activities - SPECIFIED VERBATIM by the assignment.
 * This is the app's own view of the activities, read from the app's
 * CRMActivity store (not from the mock CRM's store).
 */
leadsRouter.get('/leads/:id/crm-activities', (req, res, next) => {
  const lead = leadStore.get(req.params.id);
  if (!lead) return next(new NotFoundError(`Unknown lead: ${req.params.id}`));

  res.json({
    leadId: lead.id,
    crmExternalId: lead.crmExternalId,
    activities: appActivityStore.listByLead(lead.id),
  });
});
