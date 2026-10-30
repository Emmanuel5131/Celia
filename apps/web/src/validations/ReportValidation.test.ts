import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import { NewReportValidation } from './ReportValidation';

describe('New report format', () => {
  it('describes a new report as a JSON schema an assistant can read', () => {
    const schema = z.toJSONSchema(NewReportValidation);

    expect(schema).toMatchObject({
      type: 'object',
      properties: { headline: { type: 'string' }, tests: { type: 'array' } },
    });
  });
});
