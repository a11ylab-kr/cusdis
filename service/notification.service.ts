import { Comment } from '@prisma/client'
import { RequestScopeService } from '.'
import { getSession, prisma, resolvedConfig } from '../utils.server'
import { UserService } from './user.service'
import { markdown } from './comment.service'
import { TokenService } from './token.service'
import { EmailService } from './email.service'
import { statService } from './stat.service'
import { makeNewCommentEmailTemplate } from '../templates/new_comment'
import { makeReplyNotificationTemplate } from '../templates/reply_notification'

export class NotificationService extends RequestScopeService {
  userService = new UserService(this.req)
  tokenService = new TokenService()
  emailService = new EmailService()

  // notify when new comment added
  async addComment(comment: Comment, projectId: string) {
    // don't notify if comment is created by moderator
    if (comment.moderatorId) {
      return
    }

    // check if user enable notify
    const project = await prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        enableNotification: true,
        owner: {
          select: {
            id: true,
            email: true,
            enableNewCommentNotification: true,
            notificationEmail: true,
          },
        },
      },
    })

    // don't notify if disable in project settings
    if (!project.enableNotification) {
      return
    }

    const fullComment = await prisma.comment.findUnique({
      where: {
        id: comment.id,
      },
      select: {
        page: {
          select: {
            title: true,
            slug: true,
            project: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    })

    const notificationEmail =
      project.owner.notificationEmail || project.owner.email

    if (project.owner.enableNewCommentNotification) {
      let unsubscribeToken = this.tokenService.genUnsubscribeNewCommentToken(
        project.owner.id,
      )

      const approveToken = await this.tokenService.genApproveToken(comment.id)

      const msg = {
        to: notificationEmail, // Change to your recipient
        from: resolvedConfig.smtp.senderAddress,
        subject: `New comment on "${fullComment.page.project.title}"`,
        html: makeNewCommentEmailTemplate({
          page_slug: fullComment.page.title || fullComment.page.slug,
          by_nickname: comment.by_nickname,
          approve_link: `${resolvedConfig.host}/open/approve?token=${approveToken}`,
          unsubscribe_link: `${resolvedConfig.host}/api/open/unsubscribe?token=${unsubscribeToken}`,
          content: markdown.render(comment.content),
          notification_preferences_link: `${resolvedConfig.host}/user`,
        }),
      }

      try {
        console.log('[notification] sending new comment email')
        await this.emailService.send(msg)
        console.log('[notification] email sent successfully')
      } catch (e) {
        console.error('[notification] failed to send email:', e)
      }
    }
  }

  async addReply(comment: Comment) {
    if (!comment.parentId) {
      return
    }

    const reply = await prisma.comment.findUnique({
      where: {
        id: comment.id,
      },
      select: {
        by_email: true,
        by_nickname: true,
        content: true,
        parent: {
          select: {
            by_email: true,
            acceptNotify: true,
            content: true,
          },
        },
        page: {
          select: {
            slug: true,
          },
        },
      },
    })

    if (!reply?.parent?.acceptNotify || !reply.parent.by_email) {
      return
    }

    const recipient = reply.parent.by_email.trim().toLowerCase()
    const sender = reply.by_email?.trim().toLowerCase()
    if (sender && sender === recipient) {
      return
    }

    const pageSlug = reply.page.slug.replace(/[\r\n]+/g, ' ')
    const msg = {
      to: reply.parent.by_email,
      from: this.emailService.sender,
      subject: `New reply on "${pageSlug}"`,
      html: makeReplyNotificationTemplate({
        page_slug: pageSlug,
        original_content: markdown.render(reply.parent.content),
        reply_content: markdown.render(reply.content),
        reply_author: reply.by_nickname,
      }),
    }

    try {
      console.log('[notification] sending reply email')
      await this.emailService.send(msg)
      console.log('[notification] reply email sent successfully')
      statService.capture('send_reply_notification_email')
    } catch (e) {
      console.error('[notification] failed to send reply email:', e)
    }
  }
}
