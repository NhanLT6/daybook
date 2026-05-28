import { Page } from '@playwright/test';

async function createOrOpenProject(page: Page, contactName: string, projectName: string) {
  // When no projects exist Xero shows an empty state without the list element.
  // Use a short timeout so we don't hang on that case.
  const listVisible = await page
    .locator('div[data-automationid="list-view-list"]')
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (listVisible) {
    // Check if Project exists
    const projectElement = page
      .locator('a[data-automationid="project-list-item"]')
      .filter({
        has: page.locator('div[data-automationid="project-item-project-name"]', { hasText: projectName }),
      })
      .filter({
        has: page.locator('span[data-automationid="project-item-contact-name"]', { hasText: contactName }),
      });

    if ((await projectElement.count()) > 0) {
      console.log(`📁 Project "${projectName}" — already exists`);
      await openProject(page, contactName, projectName);
      return;
    }
  }

  // Project not found (or list is empty) — create it
  console.log(`📁 Project "${projectName}" — creating new`);
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByRole('button', { name: 'In progress' }).click();

  // Contact
  await page.getByPlaceholder('Find or create a contact').fill(contactName);
  const contactButton = page.locator('button[data-automationid="autocompleter-option--body"]', {
    hasText: contactName,
  });
  // Wait for autocomplete dropdown to appear with the contact
  await contactButton.waitFor({ state: 'visible' });
  await contactButton.click();

  // Project name
  await page.getByLabel('Project name').fill(projectName);

  // Save
  await page.getByRole('button', { name: 'Create' }).click();
  await page.locator('section[data-automationid="project-modal-modal"]').waitFor({ state: 'hidden' });
}

async function openProject(page: Page, contactName: string, projectName: string) {
  await page
    .locator('a[data-automationid="project-list-item"]')
    .filter({
      has: page.locator('div[data-automationid="project-item-project-name"]', { hasText: projectName }),
    })
    .filter({
      has: page.locator('span[data-automationid="project-item-contact-name"]', { hasText: contactName }),
    })
    .click();
}

async function goBackToAllProjects(page: Page) {
  await page.getByRole('link', { name: 'All projects' }).click();
}

export { createOrOpenProject, goBackToAllProjects };
