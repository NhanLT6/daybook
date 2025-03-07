import { describe } from 'node:test';

import { expect, test } from '@playwright/test';

// See here how to get started:
// https://playwright.dev/docs/intro
test('visits the app root url', async ({ page }) => {
  await page.goto('https://google.com');
  await expect(page.locator('div.greetings > h1')).toHaveText('You did it!');
});

// describe('Log Xero', () => {
//   test('login', async ({ page }) => {
//     await page.goto(
//       'https://login.xero.com/identity/user/login?ReturnUrl=%2Fidentity%2Fconnect%2Fauthorize%2Fcallback%3Fclient_id%3Dxero_business_go%26redirect_uri%3Dhttps%253A%252F%252Fgo.xero.com%252Foidc%252Fcallback.html%26response_type%3Dcode%26scope%3Dopenid%2520profile%2520email%2520xero_frontend-apis%2520xero_frontend-platform-apis%26state%3D2ea49d1dd0324f859492ffab4a087327%26code_challenge%3DTfaFmQ0nQIN35Y8boClG7JIjsGoXkKQBQasunDcgOJY%26code_challenge_method%3DS256%26response_mode%3Dquery',
//     );
//     // await page.getByPlaceholder('Email address').click();
//     await page.getByPlaceholder('Email address').fill('nhan.le@commissionfactory.com');
//     // await page.getByPlaceholder('Password').click();
//     await page.getByPlaceholder('Password').fill('@Nic112233');
//
//     await page.getByRole('button', { name: 'Log in' }).click();
//   });
//
//   // test('test', async ({ page }) => {
//   //   await page.getByLabel('Trust this device', { exact: true }).check();
//   //   await page.getByPlaceholder('123456').click();
//   //   await page.getByPlaceholder('123456').fill('751490');
//   //   await page.getByRole('button', { name: 'Confirm' }).click();
//   //
//   //   await page.goto('https://go.xero.com/app/!lep5g/projects?CID=!lep5g');
//   //   await page.getByRole('button', { name: 'New project' }).click();
//   //   await page.getByRole('button', { name: 'In progress' }).click();
//   //   await page.getByPlaceholder('Find or create a contact').click();
//   //   await page.getByPlaceholder('Find or create a contact').fill('nhan le');
//   //   await page.getByRole('button', { name: 'NL Nhan Le' }).click();
//   //   await page.getByLabel('Project name').click();
//   //   await page.getByLabel('Project name').fill('DS-2890 Prepare the feature branch and deployment checklist');
//   //   await page.getByRole('button', { name: 'Create' }).click();
//   //   await page.getByRole('button', { name: 'Add' }).click();
//   //   await page.getByRole('button', { name: 'Task' }).click();
//   //   await page.getByPlaceholder('Name or choose task').click();
//   //   await page
//   //     .getByPlaceholder('Name or choose task')
//   //     .fill('DS-2890 Prepare the feature branch and deployment checklist');
//   //   await page.getByRole('button', { name: 'Save', exact: true }).click();
//   //   await page.getByRole('button', { name: 'Add' }).click();
//   //   await page.getByRole('link', { name: 'DS-2890 Prepare the feature' }).getByLabel('More options').click();
//   //   await page.getByRole('button', { name: 'Add time' }).click();
//   //   await page.getByPlaceholder('0:').fill('4');
//   //   await page.getByPlaceholder('Choose a date').click();
//   //   await page.getByLabel('Wed Nov 13').click();
//   //   await page.getByRole('button', { name: 'Save', exact: true }).click();
//   //   await page.getByRole('link', { name: 'All projects' }).click();
//   // });
// });
