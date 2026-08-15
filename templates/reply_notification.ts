function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function makeReplyNotificationTemplate(data: {
  page_slug: string
  original_content: string
  reply_content: string
  reply_author: string
}) {
  const pageSlug = escapeHtml(data.page_slug)
  const replyAuthor = escapeHtml(data.reply_author)

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>New reply on ${pageSlug}</title>
  </head>
  <body style="font-family: Arial, Helvetica, sans-serif; line-height: 1.5; color: #111111;">
    <main style="max-width: 600px; margin: 0 auto;">
      <h1 style="font-size: 24px;">New reply on ${pageSlug}</h1>
      <p>${replyAuthor} replied to your comment.</p>
      <h2 style="font-size: 18px;">Your comment</h2>
      <blockquote style="margin-left: 0; padding-left: 16px; border-left: 4px solid #cccccc;">
        ${data.original_content}
      </blockquote>
      <h2 style="font-size: 18px;">Reply</h2>
      <div>${data.reply_content}</div>
      <p style="color: #555555; font-size: 13px;">You received this email because you selected reply notifications when posting your comment.</p>
    </main>
  </body>
</html>`
}
