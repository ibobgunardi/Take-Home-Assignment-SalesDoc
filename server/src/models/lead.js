import { nextId } from './ids.js';

/**
 * Lead - spec fields: id, name, company, phone, email, crmExternalId (optional).
 * `crmExternalId` is null until the first CRM sync writes it back (D-01, R-02).
 */
export function createLead({ id, name, company, phone, email }) {
  return {
    id: id ?? nextId('lead'),
    name,
    company,
    phone,
    email,
    crmExternalId: null,
  };
}
