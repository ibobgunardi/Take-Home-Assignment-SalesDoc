import { createLead } from './models/lead.js';
import { resetIds } from './models/ids.js';
import * as leadStore from './store/leads.js';
import * as callStore from './store/calls.js';
import * as sessionStore from './store/sessions.js';
import * as activityStore from './store/crm-activities.js';
import * as mockCrm from './services/mock-crm.js';
import * as crmSync from './services/crm-sync.js';
import { DEMO_AGENT_ID } from './config.js';

// R-12: 4-8 leads. Six is enough to show a queue draining across several
// rounds (2 lines, so 3 rounds) without making the demo long.
const SEED_LEADS = [
  { name: 'Amelia Hartono', company: 'Nusantara Logistics', phone: '+62 811 2000 101', email: 'amelia.hartono@nusantaralog.co.id' },
  { name: 'Daniel Prasetyo', company: 'Meridian Fintech', phone: '+62 811 2000 102', email: 'daniel.prasetyo@meridianfin.com' },
  { name: 'Grace Wijaya', company: 'Sentra Health Group', phone: '+62 811 2000 103', email: 'grace.wijaya@sentrahealth.id' },
  { name: 'Rizky Ananda', company: 'Bumi Agritech', phone: '+62 811 2000 104', email: 'rizky.ananda@bumiagritech.co.id' },
  { name: 'Priya Raman', company: 'Vertex Manufacturing', phone: '+65 8100 2005', email: 'priya.raman@vertexmfg.sg' },
  { name: 'Marcus Chen', company: 'Halcyon Retail', phone: '+65 8100 2006', email: 'marcus.chen@halcyonretail.sg' },
];

/**
 * Reset every in-memory store and re-seed the leads.
 *
 * Called on boot (R-108c) so a restarted instance is immediately usable, and
 * by tests between cases so ordering cannot matter.
 */
export function seed() {
  leadStore.clear();
  callStore.clear();
  sessionStore.clear();
  activityStore.clear();
  mockCrm.clear();
  crmSync.clear();
  resetIds();

  for (const lead of SEED_LEADS) {
    leadStore.put(createLead(lead));
  }

  return { agentId: DEMO_AGENT_ID, leads: leadStore.list() };
}
