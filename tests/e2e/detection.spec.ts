import { expect, test } from '@playwright/test'
import { Document, Packer, Paragraph } from 'docx'

const longText = '这是一段用于浏览器端到端验证的中文论文正文，检测结果仅用于演示完整产品流程。'.repeat(12)

test('pastes text, reaches the report, filters markup, and downloads HTML', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('textbox', { name: '论文正文' }).fill(longText)
  await page.getByRole('button', { name: '开始检测' }).click()

  await expect(page).toHaveURL(/\/report\/det_/u)
  await expect(page.getByText('本地规则检测')).toBeVisible()
  await expect(page.getByText('AI 倾向', { exact: true }).first()).toBeVisible()

  await page.getByRole('tab', { name: 'AI 倾向' }).click()
  await expect(page.locator('.text-mark-ai').first()).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('link', { name: /HTML/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/检测报告\.html$/u)
})

test('uploads a generated Word document and keeps the mobile layout within the viewport', async ({ page }) => {
  const document = new Document({
    sections: [{ children: [new Paragraph({ text: longText })] }],
  })
  const buffer = await Packer.toBuffer(document)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('tab', { name: '上传文件' }).click()
  await page.getByLabel('上传 Word 或 PDF').setInputFiles({
    name: '端到端样例.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    buffer,
  })
  await expect(page.getByText('端到端样例.docx')).toBeVisible()
  await page.getByRole('button', { name: '开始检测' }).click()

  await expect(page).toHaveURL(/\/report\/det_/u)
  await expect(page.getByText('端到端样例.docx')).toBeVisible()
  expect(await page.locator('html').evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(391)
})
