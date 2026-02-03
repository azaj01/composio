import { openapi } from '@/lib/openapi';
import { createAPIPage } from 'fumadocs-openapi/ui';
import client from './api-page.client';
import { generateSchemaData } from './schema-generator';
import { CustomSchemaUI } from './custom-schema-ui';

export const APIPage = createAPIPage(openapi, {
  client,
  schemaUI: {
    render: (options, ctx) => {
      const generated = generateSchemaData(
        {
          root: options.root,
          readOnly: options.readOnly,
          writeOnly: options.writeOnly,
        },
        {
          renderMarkdown: ctx.renderMarkdown,
          schema: { getRawRef: ctx.schema.getRawRef },
        }
      );
      return (
        <CustomSchemaUI
          name={options.client.name}
          required={options.client.required}
          as={options.client.as}
          generated={generated}
        />
      );
    },
  },
});
