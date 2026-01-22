/**
 * File-handling Example
 *
 * This example demonstrates how to use Composio SDK for file-handling.
 *
 * Prerequisites:
 * 1. Set up your COMPOSIO_API_KEY in the .env file
 * 3. Run the example: pnpm start
 */

import { Composio } from '@composio/core';
import 'dotenv/config';
import path from 'path';

/**
 * Initialize Composio
 */
const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY,
});

/**
 * Main function to run the example
 */
async function main() {
  try {
    console.log('🚀 Starting File-handling Example...');

    // Get available tools
    const tools = await composio.tools.get('jkomyno', 'GMAIL_SEND_EMAIL');

    console.log(`✅ Found ${tools.length} tools`);

    const filePath = path.join(__dirname, '..', 'pepe-silvia.png');
    console.log(`Sending file from ${filePath}`);

    const result = await composio.tools.execute('GMAIL_SEND_EMAIL', {
      userId: 'jkomyno',
      arguments: {
        attachment: filePath,
        recipient_email: 'alberto.schiabel@gmail.com',
        user_id: 'me',
        body: 'Hello, this is a test email with a file attachment.',
        subject: 'Test Email with Attachment',
      },
      dangerouslySkipVersionCheck: true,
    });

    console.log(result);
  } catch (error) {
    console.error('❌ Error running example:', error);
  }
}

// Run the example
main().catch(console.error);
