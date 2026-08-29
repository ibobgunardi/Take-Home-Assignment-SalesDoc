import { Router } from 'express';
import * as mockCrm from '../services/mock-crm.js';

/**
 * The two specified mock-CRM inspection endpoints, at their literal paths.
 *
 * These read the mock CRM's OWN store, which is separate from the app's
 * CRMActivity store (D-12). A reviewer comparing GET /mock-crm/activities with
 * GET /leads/:id/crm-activities is looking at two genuinely different stores
 * that the sync writes to together.
 */
export const mockCrmRouter = Router();

mockCrmRouter.get('/mock-crm/contacts', (req, res) => {
  res.json({ contacts: mockCrm.listContacts() });
});

mockCrmRouter.get('/mock-crm/activities', (req, res) => {
  res.json({ activities: mockCrm.listActivities() });
});
