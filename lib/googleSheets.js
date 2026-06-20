// Google Sheets integration via OAuth (works with a personal Gmail).
// Requires env:
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   GOOGLE_OAUTH_REFRESH_TOKEN   (one-time, from the OAuth Playground)
// Uses the per-file scope drive.file: the tool can only touch sheets IT creates.
import { google } from 'googleapis';

function authClient() {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refresh = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (!id || !secret || !refresh) {
    throw new Error('Google not connected — set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REFRESH_TOKEN in Vercel.');
  }
  const o = new google.auth.OAuth2(id, secret);
  o.setCredentials({ refresh_token: refresh });
  return o;
}

export function googleSheetsEnabled() {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REFRESH_TOKEN);
}

/** Create an editable Google Sheet (in YOUR Drive) and write the product rows. */
export async function createClientSheet({ title, header, rows, shareEmail }) {
  const auth = authClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  const created = await sheets.spreadsheets.create({ requestBody: { properties: { title } } });
  const spreadsheetId = created.data.spreadsheetId;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'A1',
    valueInputOption: 'RAW',
    requestBody: { values: [header, ...rows] },
  });

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

  // Anyone with the link can edit — no "request access" screen.
  try {
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: { type: 'anyone', role: 'writer' },
    });
  } catch {}

  // Also share directly with the client's email (so it shows in their Drive).
  if (shareEmail) {
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        sendNotificationEmail: false,
        requestBody: { type: 'user', role: 'writer', emailAddress: shareEmail },
      });
    } catch {}
  }

  return { id: spreadsheetId, url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` };
}
