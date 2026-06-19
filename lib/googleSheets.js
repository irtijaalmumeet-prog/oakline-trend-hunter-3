// Google Sheets integration (Workspace service account).
// Requires env:
//   GOOGLE_SERVICE_ACCOUNT_JSON  - the full service-account key JSON (as one string)
//   GOOGLE_SHARED_DRIVE_ID       - a Shared Drive ID the service account can write to
import { google } from 'googleapis';

function authClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Google Sheets not connected — set GOOGLE_SERVICE_ACCOUNT_JSON in Vercel.');
  let creds;
  try { creds = JSON.parse(raw); } catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.'); }
  return new google.auth.JWT({
    email: creds.client_email,
    key: (creds.private_key || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
  });
}

export function googleSheetsEnabled() {
  return !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
}

/** Create an editable Google Sheet for a client and write the product rows. */
export async function createClientSheet({ title, header, rows, shareEmail }) {
  const auth = authClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });
  const driveId = process.env.GOOGLE_SHARED_DRIVE_ID || '';

  let spreadsheetId;
  if (driveId) {
    // Create inside a Shared Drive (recommended for Workspace).
    const file = await drive.files.create({
      supportsAllDrives: true,
      requestBody: { name: title, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [driveId] },
      fields: 'id',
    });
    spreadsheetId = file.data.id;
  } else {
    const created = await sheets.spreadsheets.create({ requestBody: { properties: { title } } });
    spreadsheetId = created.data.spreadsheetId;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    requestBody: { values: [header, ...rows] },
  });

  // Bold the header row.
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ repeatCell: {
        range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: 'userEnteredFormat.textFormat.bold',
      } }] },
    });
  } catch {}

  if (shareEmail) {
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        supportsAllDrives: true,
        sendNotificationEmail: false,
        requestBody: { type: 'user', role: 'writer', emailAddress: shareEmail },
      });
    } catch (e) { /* sharing best-effort */ }
  }

  return { id: spreadsheetId, url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` };
}
