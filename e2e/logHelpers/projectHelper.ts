import { Page } from '@playwright/test';

async function createOrOpenProject(page: Page, contactName: string, projectName: string) {
  // Wait for a project list to be loaded
  await page.locator('div[data-automationid="list-view-list"]').waitFor({ state: 'visible' });

  // Check if Project exists
  const projectElement = page
    .locator('a[data-automationid="project-list-item"]')
    .filter({
      has: page.locator('div[data-automationid="project-item-project-name"]', { hasText: projectName }),
    })
    .filter({
      has: page.locator('span[data-automationid="project-item-contact-name"]', { hasText: contactName }),
    });

  const isProjectExist = (await projectElement.count()) > 0;
  if (isProjectExist) {
    await openProject(page, contactName, projectName);
    return;
  }

  // If project doesn't exist, create it
  await page.getByRole('button', { name: 'New project' }).click();
  await page.getByRole('button', { name: 'In progress' }).click();

  // Contact
  await page.getByPlaceholder('Find or create a contact').fill(contactName);
  const contactButton = page.locator('button[data-automationid="autocompleter-option--body"]', {
    hasText: contactName,
  });
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
